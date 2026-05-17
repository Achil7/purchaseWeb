import React from 'react';
import BuyerAnalyticsDashboard from '../common/BuyerAnalyticsDashboard';

function OperatorBuyerAnalytics({ viewAsUserId = null }) {
  return <BuyerAnalyticsDashboard viewAsUserId={viewAsUserId} />;
}

export default OperatorBuyerAnalytics;
