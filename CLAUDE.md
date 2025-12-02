# CLAUDE.md - CampManager Project Guide

**Last Updated:** 2025-12-02
**Project:** purchaseWeb (CampManager)
**Version:** 0.1.0

## Table of Contents
1. [Project Overview](#project-overview)
2. [Technology Stack](#technology-stack)
3. [Codebase Structure](#codebase-structure)
4. [User Roles & Access Patterns](#user-roles--access-patterns)
5. [Routing Architecture](#routing-architecture)
6. [Component Patterns & Conventions](#component-patterns--conventions)
7. [Development Workflow](#development-workflow)
8. [Key Files Reference](#key-files-reference)
9. [Guidelines for AI Assistants](#guidelines-for-ai-assistants)

---

## Project Overview

**CampManager** is a multi-role campaign management web application built with React. It provides role-based dashboards for managing marketing campaigns, products (items), and buyers/reviews.

### Primary User Roles
- **영업사 (Sales)**: Campaign registration and management
- **총관리자 (Admin)**: Operator assignment and overall management
- **진행자 (Operator)**: Review writing and campaign execution
- **브랜드사 (Brand)**: Results viewing and monitoring

### Key Features
- Multi-level drill-down navigation (Campaign → Items → Buyers)
- Role-based access control and UI customization
- Campaign assignment and operator management
- Shared component architecture for code reusability

---

## Technology Stack

### Core Framework
- **React 19.2.0** - Modern React with latest features
- **React Router DOM 7.9.6** - Client-side routing with nested routes
- **Create React App 5.0.1** - Build tooling and development server

### UI Framework
- **Material-UI (MUI) 7.3.5** - Primary component library
  - `@mui/material` - Core components
  - `@mui/icons-material` - Icon library
  - `@emotion/react` & `@emotion/styled` - CSS-in-JS styling
- **Lucide React 0.555.0** - Additional icon library

### Testing
- **Jest** - Test runner (via react-scripts)
- **React Testing Library 16.3.0** - Component testing
- **@testing-library/jest-dom 6.9.1** - Custom matchers
- **@testing-library/user-event 13.5.0** - User interaction simulation

### Development Tools
- **ESLint** - Code linting (configured via react-app)
- **Web Vitals 2.1.4** - Performance monitoring

---

## Codebase Structure

```
purchaseWeb/
├── public/                      # Static assets
│   ├── index.html              # HTML template
│   ├── favicon.ico             # Site icon
│   ├── logo192.png             # PWA icon (192x192)
│   ├── logo512.png             # PWA icon (512x512)
│   ├── manifest.json           # PWA manifest
│   └── robots.txt              # Search engine directives
│
├── src/                        # Source code
│   ├── components/             # React components
│   │   ├── admin/             # Admin-specific components
│   │   │   └── AdminDashboard.js
│   │   ├── brand/             # Brand-specific components
│   │   │   ├── BrandLayout.js
│   │   │   ├── BrandCampaignTable.js
│   │   │   ├── BrandItemTable.js
│   │   │   └── BrandBuyerTable.js
│   │   ├── operator/          # Operator-specific components
│   │   │   ├── OperatorLayout.js
│   │   │   ├── OperatorCampaignTable.js
│   │   │   ├── OperatorItemTable.js
│   │   │   ├── OperatorBuyerTable.js
│   │   │   ├── OperatorHome.js
│   │   │   └── OperatorAddBuyerDialog.js
│   │   ├── sales/             # Sales-specific components
│   │   │   └── SalesDashboard.js
│   │   └── SharedCampaignTable.js  # Shared component for all roles
│   │
│   ├── App.js                 # Main app component with routing
│   ├── App.css                # App-level styles
│   ├── App.test.js            # App component tests
│   ├── index.js               # Application entry point
│   ├── index.css              # Global styles
│   ├── setupTests.js          # Test configuration
│   └── reportWebVitals.js     # Performance monitoring
│
├── .gitignore                 # Git ignore rules
├── package.json               # Dependencies and scripts
├── package-lock.json          # Dependency lock file
├── README.md                  # Standard CRA documentation
└── CLAUDE.md                  # This file (AI assistant guide)
```

### Directory Conventions

1. **Component Organization by Role**: Components are organized in role-specific folders (`admin/`, `brand/`, `operator/`, `sales/`)
2. **Shared Components**: Cross-role components are placed at the root of `components/` (e.g., `SharedCampaignTable.js`)
3. **Layout Pattern**: Each role has a dedicated Layout component that wraps nested routes
4. **Naming Convention**: Components use PascalCase with role prefix (e.g., `OperatorLayout`, `BrandCampaignTable`)

---

## User Roles & Access Patterns

### Role Constants
Defined in `src/components/SharedCampaignTable.js:12-17`:

```javascript
export const USER_ROLES = {
  SALES: 'SALES',       // 영업사
  ADMIN: 'ADMIN',       // 총 관리자
  OPERATOR: 'OPERATOR', // 진행자
  BRAND: 'BRAND'        // 브랜드사
};
```

### Role-Based Features

| Role | Primary Function | Key Features |
|------|-----------------|--------------|
| **Sales (영업사)** | Campaign creation | New campaign registration, campaign management |
| **Admin (총관리자)** | System oversight | Operator assignment, full campaign access |
| **Operator (진행자)** | Campaign execution | Review writing, buyer management |
| **Brand (브랜드사)** | Results viewing | Campaign results, performance monitoring |

### Access Control Pattern
- Each role has a dedicated Layout component with role-specific header/navigation
- The `SharedCampaignTable` component adapts UI based on `userRole` prop
- Different columns and actions are shown/hidden based on role
- Navigation paths are prefixed with role (e.g., `/operator/campaign/1`)

---

## Routing Architecture

### Route Structure (from `src/App.js`)

```
/                                    → Home (role selection)
├── /sales                          → SalesDashboard
├── /admin                          → AdminDashboard
├── /operator                       → OperatorLayout
│   ├── index                       → OperatorCampaignTable (campaign list)
│   ├── campaign/:campaignId        → OperatorItemTable (items in campaign)
│   └── campaign/:campaignId/item/:itemId → OperatorBuyerTable (buyers/reviews)
└── /brand                          → BrandLayout
    ├── index                       → BrandCampaignTable (campaign list)
    ├── campaign/:campaignId        → BrandItemTable (items in campaign)
    └── campaign/:campaignId/item/:itemId → BrandBuyerTable (buyers/reviews)
```

### Drill-Down Navigation Pattern
The app implements a 3-level drill-down structure for Operator and Brand roles:

1. **Level 1**: Campaign List (index route)
2. **Level 2**: Items within a campaign (`campaign/:campaignId`)
3. **Level 3**: Buyers/Reviews for an item (`campaign/:campaignId/item/:itemId`)

### URL Parameter Conventions
- `:campaignId` - Numeric identifier for campaigns
- `:itemId` - Numeric identifier for items/products
- Role prefix in path (e.g., `/operator/`, `/brand/`) ensures proper context

---

## Component Patterns & Conventions

### Layout Components
**Purpose**: Provide consistent header, navigation, and container for nested routes

**Example**: `src/components/operator/OperatorLayout.js:7-58`

Key features:
- Fixed AppBar with role-specific branding
- User profile display (currently hardcoded)
- Logout button navigating to home
- `<Outlet />` for nested route rendering
- Toolbar spacer to prevent content overlap with fixed header

```javascript
function OperatorLayout() {
  const navigate = useNavigate();
  return (
    <Box>
      <AppBar position="fixed">
        {/* Header content */}
      </AppBar>
      <Toolbar /> {/* Spacer */}
      <Container>
        <Outlet /> {/* Nested routes render here */}
      </Container>
    </Box>
  );
}
```

### Shared Components Pattern
**Example**: `SharedCampaignTable` component

Design principles:
- Accepts `userRole` prop to customize behavior
- Conditional rendering based on role
- Unified data structure with role-specific columns
- Event handlers that prevent propagation when needed (`e.stopPropagation()`)

**Key Implementation Details** (`src/components/SharedCampaignTable.js`):
- Lines 36-161: Main component with role-based customization
- Lines 63-67: Role-specific description text
- Lines 71-80: Conditional button rendering (Sales only)
- Lines 95-97: Conditional column rendering (Admin only)
- Lines 121-140: Conditional operator assignment dropdown

### Table Navigation Pattern
Tables use `onClick` handlers on `TableRow` to navigate:
```javascript
<TableRow
  onClick={() => navigate(`/${userRole.toLowerCase()}/campaign/${camp.id}`)}
  sx={{ cursor: 'pointer' }}
>
```

### Material-UI Styling Pattern
The codebase consistently uses MUI's `sx` prop for inline styling:
```javascript
<Box sx={{
  minHeight: '100vh',
  bgcolor: '#f5f5f5',
  display: 'flex',
  alignItems: 'center'
}}>
```

### Icon Usage
- MUI Icons: Primary icon library (`@mui/icons-material`)
- Lucide React: Secondary icon library for additional options
- Icons are used consistently in buttons, cards, and table rows

---

## Development Workflow

### Available Scripts

#### Development
```bash
npm start
```
- Starts development server on `http://localhost:3000`
- Hot reloading enabled
- Opens browser automatically

#### Testing
```bash
npm test
```
- Runs Jest in watch mode
- Runs all `*.test.js` files
- Interactive test runner with coverage options

#### Production Build
```bash
npm run build
```
- Creates optimized production build in `build/` folder
- Minifies code and generates source maps
- Outputs bundle analysis information

#### Eject (Not Recommended)
```bash
npm run eject
```
- One-way operation - exposes all CRA configuration
- Only use if absolutely necessary

### Development Server
- **Port**: 3000 (default)
- **Hot Reload**: Enabled
- **Error Overlay**: Enabled in browser
- **Lint Warnings**: Displayed in terminal and browser console

### Build Output
- **Directory**: `build/`
- **Assets**: Hashed filenames for cache busting
- **Optimization**: Code splitting, minification, tree shaking

---

## Key Files Reference

### Entry Point
- **src/index.js:1-18** - React app initialization, StrictMode enabled

### Main Application
- **src/App.js:115-149** - Main App component with Router and all route definitions
- **src/App.js:27-113** - Home component with role selection cards

### Routing Configuration
- **src/App.js:119-147** - Complete route tree with nested routes for Operator and Brand

### Shared Logic
- **src/components/SharedCampaignTable.js:12-17** - USER_ROLES constant definition
- **src/components/SharedCampaignTable.js:20-31** - Mock data structure for campaigns and operators

### Layout Templates
- **src/components/operator/OperatorLayout.js** - Operator role layout
- **src/components/brand/BrandLayout.js** - Brand role layout

### Configuration
- **package.json:21-26** - npm scripts
- **package.json:5-20** - Project dependencies
- **.gitignore** - Only ignores `node_modules/`

---

## Guidelines for AI Assistants

### Code Modification Principles

#### 1. **Maintain Existing Patterns**
- Follow the established component organization by role
- Keep naming conventions consistent (RoleNameComponent pattern)
- Use Material-UI components and `sx` prop for styling
- Preserve the drill-down navigation structure

#### 2. **Role-Based Development**
When adding features:
- Consider which roles need access
- Update `SharedCampaignTable` if feature spans multiple roles
- Create role-specific components in appropriate directories
- Add routes in `App.js` following the nested pattern

#### 3. **Component Guidelines**

**Creating New Components:**
```javascript
// Place in appropriate role folder
// src/components/operator/OperatorNewFeature.js
import React from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Box, Typography } from '@mui/material';

function OperatorNewFeature() {
  const navigate = useNavigate();
  const { campaignId } = useParams(); // If nested route

  return (
    <Box sx={{ /* Material-UI styling */ }}>
      {/* Component content */}
    </Box>
  );
}

export default OperatorNewFeature;
```

**Modifying Shared Components:**
- Check all roles that use the component
- Add `userRole` conditional logic if behavior differs by role
- Update mock data structures consistently
- Test navigation paths for all roles

#### 4. **Routing Changes**

**Adding New Routes:**
1. Determine if route is role-specific or global
2. Add route definition in `App.js:119-147`
3. For nested routes, add within appropriate Layout's `<Route>` block
4. Update navigation calls to use correct path structure
5. Ensure Layout component includes `<Outlet />` for nested routes

**Path Structure:**
- Role-specific: `/{role}/feature` (e.g., `/operator/settings`)
- Drill-down: `/{role}/campaign/:campaignId/item/:itemId`
- Global: `/feature` (e.g., `/about`)

#### 5. **Data Flow Patterns**

**Current State Management:**
- Components use local `useState` for mock data
- No global state management library (Redux, Context API) yet
- Data is passed via props or read from mock constants

**When Adding API Integration:**
- Replace mock data arrays with API calls
- Consider adding loading and error states
- Maintain the same data structure for compatibility
- Update mock data comments to indicate API source

#### 6. **Styling Guidelines**

**Material-UI Theme:**
- Use MUI color palette (e.g., `primary`, `secondary`, `error`)
- Consistent color scheme per role:
  - Operator: Teal/Green (`#00897b`)
  - Brand: Purple (`#8e24aa`)
  - Sales: Blue (`#1976d2`)
  - Admin: Deep Purple (`#673ab7`)

**Responsive Design:**
- Use MUI Grid for layouts
- Apply responsive breakpoints: `xs`, `sm`, `md`, `lg`, `xl`
- Test on mobile and desktop viewports

**Spacing:**
- Use MUI spacing units in `sx` prop (e.g., `mt: 4` = 32px)
- Maintain consistent padding/margin patterns

#### 7. **Testing Considerations**

**Test File Location:**
- Co-locate test files with components or in `__tests__` folder
- Follow naming: `ComponentName.test.js`

**Test Structure:**
```javascript
import { render, screen } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import ComponentName from './ComponentName';

test('renders component correctly', () => {
  render(
    <BrowserRouter>
      <ComponentName />
    </BrowserRouter>
  );
  // Test assertions
});
```

**What to Test:**
- Component renders without crashing
- Role-based conditional rendering
- Navigation on button/row clicks
- Mock data displays correctly

#### 8. **Common Operations**

**Adding a New Role-Specific Page:**
1. Create component in `src/components/{role}/RoleNewPage.js`
2. Import in `src/App.js`
3. Add route in appropriate section
4. Add navigation link in Layout component
5. Test navigation flow

**Adding a Column to Campaign Table:**
1. Update mock data in `SharedCampaignTable.js:20-24`
2. Add `<TableCell>` in header (`TableHead`)
3. Add corresponding `<TableCell>` in body (`TableBody`)
4. Consider role-based visibility with conditional rendering

**Implementing API Integration:**
1. Create API utility file (e.g., `src/services/api.js`)
2. Replace `useState` initialization with `useEffect` + API call
3. Add loading state: `const [loading, setLoading] = useState(true)`
4. Add error handling with try-catch
5. Update UI to show loading spinner and error messages

#### 9. **Performance Best Practices**

- Avoid unnecessary re-renders with `React.memo()` for expensive components
- Use `useCallback` for event handlers passed to child components
- Implement pagination for large data tables (not currently present)
- Lazy load routes if bundle size grows: `React.lazy()` + `Suspense`

#### 10. **Accessibility**

- Ensure all interactive elements have proper `aria-label`
- Maintain keyboard navigation support
- Use semantic HTML elements
- Test with screen readers when adding complex interactions

### Common Pitfalls to Avoid

1. **Navigation Issues**
   - ❌ Don't use `<a>` tags for internal links
   - ✅ Use `navigate()` from `useNavigate()` hook or `<Link>` component

2. **Route Parameter Mismatches**
   - ❌ Don't hardcode IDs in navigation
   - ✅ Use template literals: `` navigate(`/operator/campaign/${id}`) ``

3. **Event Propagation in Tables**
   - ❌ Don't forget `e.stopPropagation()` on interactive elements inside clickable rows
   - ✅ Add `onClick={(e) => e.stopPropagation()}` to dropdowns, buttons in rows

4. **Styling Conflicts**
   - ❌ Don't mix inline styles with `sx` prop
   - ✅ Use `sx` prop consistently for Material-UI components

5. **Mock Data Management**
   - ❌ Don't duplicate mock data across components
   - ✅ Keep mock data in shared files or top-level components

### File Modification Checklist

When modifying code, verify:
- [ ] Import statements are correct and components exist
- [ ] Route paths match navigation calls
- [ ] Role-based logic is consistent across affected components
- [ ] No console errors in browser
- [ ] Component renders correctly for all relevant roles
- [ ] Navigation flow works end-to-end
- [ ] Styling is consistent with existing patterns
- [ ] Comments explain complex logic (Korean or English is acceptable)

### Debugging Tips

**Component Not Rendering:**
1. Check `App.js` route definition
2. Verify import path and component export
3. Check browser console for errors
4. Ensure Layout component has `<Outlet />`

**Navigation Not Working:**
1. Verify `Router` wraps the App
2. Check path matches route definition exactly
3. Ensure `useNavigate()` is called inside Router context

**Styling Not Applying:**
1. Check `sx` prop syntax
2. Verify MUI theme access
3. Inspect element in browser DevTools
4. Check for CSS specificity conflicts

### Korean Comments
The codebase contains Korean comments and UI text. When modifying:
- Maintain Korean for user-facing text (UI labels, messages)
- Use English or Korean for code comments (both are acceptable)
- Keep consistency within the same file

---

## Version History

| Date | Version | Changes |
|------|---------|---------|
| 2025-12-02 | 1.0.0 | Initial CLAUDE.md creation with comprehensive documentation |

---

## Additional Resources

- [React Documentation](https://react.dev/)
- [Material-UI Documentation](https://mui.com/)
- [React Router Documentation](https://reactrouter.com/)
- [Create React App Documentation](https://create-react-app.dev/)

---

**Note for AI Assistants**: This document is designed to provide comprehensive context for code modifications. Always verify your understanding by reading the actual source code before making changes. When in doubt, ask clarifying questions about the intended behavior or user requirements.
