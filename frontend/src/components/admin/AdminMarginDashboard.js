import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box, Paper, Typography, Tabs, Tab, FormControl, InputLabel, Select, MenuItem
} from '@mui/material';
import { useAuth } from '../../context/AuthContext';
import * as settlementService from '../../services/settlementService';
import EstimateTab from './margin/EstimateTab';
import RevenueTab from './margin/RevenueTab';
import ExpenseTab from './margin/ExpenseTab';
import SummaryTab from './margin/SummaryTab';

// 마진 현황 접근 허용 계정
const ALLOWED_MARGIN_USERS = ['masterkangwoo'];

function AdminMarginDashboard() {
  const navigate = useNavigate();
  const { user } = useAuth();

  const [activeTab, setActiveTab] = useState(0);
  const [selectedMonth, setSelectedMonth] = useState('');
  const [availableMonths, setAvailableMonths] = useState([]);
  const [refreshKey, setRefreshKey] = useState(0);

  // masterkangwoo 계정만 접근 가능
  useEffect(() => {
    if (user && !ALLOWED_MARGIN_USERS.includes(user.username)) {
      alert('접근 권한이 없습니다.');
      navigate('/admin');
    }
  }, [user, navigate]);

  // 사용 가능한 월 목록 로드
  const loadMonths = useCallback(async () => {
    try {
      const months = await settlementService.getAvailableMonths();
      setAvailableMonths(months);
      if (!selectedMonth) {
        const now = new Date();
        const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
        if (months.includes(currentMonth)) {
          setSelectedMonth(currentMonth);
        } else if (months.length > 0) {
          setSelectedMonth(months[0]);
        } else {
          setSelectedMonth(currentMonth);
        }
      }
    } catch (error) {
      console.error('월 목록 로드 실패:', error);
      if (!selectedMonth) {
        const now = new Date();
        setSelectedMonth(`${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`);
      }
    }
  }, [selectedMonth]);

  useEffect(() => {
    loadMonths();
  }, [loadMonths]);

  const handleTabChange = (_, newValue) => {
    setActiveTab(newValue);
  };

  const handleMonthChange = (e) => {
    setSelectedMonth(e.target.value);
  };

  const handleDataChanged = () => {
    setRefreshKey(prev => prev + 1);
    loadMonths();
  };

  const monthOptions = [...new Set([...availableMonths, selectedMonth].filter(Boolean))].sort().reverse();

  return (
    <Box sx={{ p: 3 }}>
      {/* 헤더 */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Typography variant="h5" fontWeight="bold">마진 현황</Typography>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          {activeTab !== 0 && (
            <FormControl size="small" sx={{ minWidth: 150 }}>
              <InputLabel>월 선택</InputLabel>
              <Select value={selectedMonth} onChange={handleMonthChange} label="월 선택">
                {monthOptions.map(m => (
                  <MenuItem key={m} value={m}>{m}</MenuItem>
                ))}
              </Select>
            </FormControl>
          )}
        </Box>
      </Box>

      {/* 탭 */}
      <Paper sx={{ mb: 2 }}>
        <Tabs value={activeTab} onChange={handleTabChange} variant="fullWidth">
          <Tab label="견적서 관리" />
          <Tab label="매출" />
          <Tab label="지출" />
          <Tab label="총정리" />
        </Tabs>
      </Paper>

      {/* 탭 컨텐츠 */}
      {activeTab === 0 && <EstimateTab />}
      {activeTab === 1 && (
        <RevenueTab
          key={`rev-${refreshKey}`}
          selectedMonth={selectedMonth}
          onDataChanged={handleDataChanged}
        />
      )}
      {activeTab === 2 && (
        <ExpenseTab
          key={`exp-${refreshKey}`}
          selectedMonth={selectedMonth}
          onDataChanged={handleDataChanged}
        />
      )}
      {activeTab === 3 && (
        <SummaryTab
          key={`sum-${refreshKey}`}
          selectedMonth={selectedMonth}
        />
      )}
    </Box>
  );
}

export default AdminMarginDashboard;
