import React from 'react';
import ReviewSearchDashboard from '../common/ReviewSearchDashboard';
import { getBrandsForReviewSearch } from '../../services/userService';

function OperatorReviewSearch({ viewAsUserId = null }) {
  return (
    <ReviewSearchDashboard
      viewAsUserId={viewAsUserId}
      scopeBrandFetcher={getBrandsForReviewSearch}
    />
  );
}

export default OperatorReviewSearch;
