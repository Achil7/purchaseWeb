import React from 'react';
import BuyerAnalyticsDashboard from '../common/BuyerAnalyticsDashboard';

function OperatorBuyerAnalytics({ viewAsUserId = null, onNavigateToCampaign = null }) {
  return <BuyerAnalyticsDashboard viewAsUserId={viewAsUserId} onNavigateToCampaign={onNavigateToCampaign} />;
}

export default OperatorBuyerAnalytics;
