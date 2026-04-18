import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  IconButton,
  Typography,
  Box,
  Chip,
  CircularProgress
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';

// Swiper imports (Array 모드에서만 사용)
import { Swiper, SwiperSlide } from 'swiper/react';
import { Navigation, Keyboard } from 'swiper/modules';
import 'swiper/css';
import 'swiper/css/navigation';

/**
 * 이미지 스와이프 뷰어 컴포넌트
 *
 * 두 가지 모드 지원:
 * 1) Array 모드(하위 호환): `images` + `initialIndex` 기반. Swiper(스와이프/드래그) 사용.
 * 2) Virtual 모드(신규): `totalCount` + `getImage(globalIndex)` 기반.
 *    10,000장 이상도 메모리/렌더 부담 없이 표시. 방향키/버튼으로 한 장씩 이동.
 *
 * Virtual 모드는 `totalCount > 0` && `typeof getImage === 'function'`일 때 활성화.
 *
 * ===== Array 모드 props =====
 * @param {Array}   images        이미지 배열 [{s3_url, file_name, id, ...}, ...]
 * @param {number}  initialIndex  시작 이미지 인덱스
 *
 * ===== Virtual 모드 props =====
 * @param {number}   totalCount            전체 이미지 개수
 * @param {function} getImage              (globalIndex) => image | null
 * @param {number}   initialGlobalIndex    시작 전역 인덱스
 * @param {function} onChangeGlobalIndex   (newGlobalIndex) => void
 * @param {function} onNeedLoad            (startIdx, endIdx) => void
 *
 * ===== 공통 props =====
 * @param {boolean}  open
 * @param {function} onClose
 * @param {function} getMeta          (image, idx) => { monthly_brand, campaign, item, buyer, ... }
 * @param {object}   buyerInfo        (Array 모드용 간단 구매자 정보)
 */
const ImageSwipeViewer = ({
  open,
  onClose,
  // Array 모드
  images = [],
  initialIndex = 0,
  // Virtual 모드
  totalCount = 0,
  getImage = null,
  initialGlobalIndex = 0,
  onChangeGlobalIndex = null,
  onNeedLoad = null,
  // 공통
  buyerInfo = null,
  getMeta = null
}) => {
  const isVirtual = totalCount > 0 && typeof getImage === 'function';
  const effectiveTotal = isVirtual ? totalCount : images.length;
  const effectiveInitial = isVirtual ? initialGlobalIndex : initialIndex;

  const [currentIndex, setCurrentIndex] = useState(effectiveInitial);
  const [swiperInstance, setSwiperInstance] = useState(null);

  // open 또는 initial 변경 시 인덱스 동기화
  useEffect(() => {
    if (open) {
      setCurrentIndex(effectiveInitial);
      if (swiperInstance && !isVirtual) {
        swiperInstance.slideTo(effectiveInitial, 0);
      }
    }
  }, [open, effectiveInitial, swiperInstance, isVirtual]);

  // Virtual 모드: 방향키/ESC 처리
  const handleKeyDown = useCallback((e) => {
    if (e.key === 'Escape') {
      onClose();
      return;
    }
    if (!isVirtual) return; // Array 모드는 Swiper Keyboard 모듈이 처리
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
      e.preventDefault();
      setCurrentIndex(prev => Math.min(effectiveTotal - 1, prev + 1));
    } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
      e.preventDefault();
      setCurrentIndex(prev => Math.max(0, prev - 1));
    }
  }, [onClose, isVirtual, effectiveTotal]);

  useEffect(() => {
    if (open) {
      document.addEventListener('keydown', handleKeyDown);
      return () => document.removeEventListener('keydown', handleKeyDown);
    }
  }, [open, handleKeyDown]);

  // Virtual 모드: 현재 인덱스 주변 구간 로드 요청 (prefetch)
  useEffect(() => {
    if (!open || !isVirtual || !onNeedLoad || effectiveTotal <= 0) return;
    const PREFETCH_RADIUS = 25;
    const start = Math.max(0, currentIndex - PREFETCH_RADIUS);
    const end = Math.min(effectiveTotal - 1, currentIndex + PREFETCH_RADIUS);
    onNeedLoad(start, end);
  }, [open, isVirtual, onNeedLoad, currentIndex, effectiveTotal]);

  // Virtual 모드: 현재 인덱스 변경 시 부모 통지
  useEffect(() => {
    if (!isVirtual || !onChangeGlobalIndex) return;
    onChangeGlobalIndex(currentIndex);
  }, [isVirtual, onChangeGlobalIndex, currentIndex]);

  // 현재 이미지
  const currentImage = useMemo(() => {
    if (isVirtual) return getImage(currentIndex);
    return images[currentIndex];
  }, [isVirtual, getImage, images, currentIndex]);

  // 식별 정보
  const meta = useMemo(() => {
    if (!currentImage || !getMeta) return null;
    return getMeta(currentImage, currentIndex);
  }, [currentImage, getMeta, currentIndex]);

  if (effectiveTotal === 0) {
    return null;
  }

  const handlePrev = () => setCurrentIndex(prev => Math.max(0, prev - 1));
  const handleNext = () => setCurrentIndex(prev => Math.min(effectiveTotal - 1, prev + 1));

  // Virtual 모드 단일 이미지 렌더
  const renderSingleImage = () => {
    if (!currentImage) {
      return (
        <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1, color: '#fff' }}>
          <CircularProgress size={40} sx={{ color: '#fff' }} />
          <Typography variant="body2" sx={{ color: 'grey.400' }}>
            이미지 로딩 중…
          </Typography>
        </Box>
      );
    }
    return (
      <img
        key={currentImage.id}
        src={currentImage.s3_url || currentImage.url}
        alt={currentImage.file_name || `이미지 ${currentIndex + 1}`}
        style={{
          maxWidth: '100%',
          maxHeight: 'calc(90vh - 120px)',
          objectFit: 'contain',
          userSelect: 'none'
        }}
        draggable={false}
      />
    );
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth={false}
      fullWidth
      PaperProps={{
        sx: {
          width: '90vw',
          maxWidth: '1200px',
          height: '90vh',
          maxHeight: '900px',
          bgcolor: 'rgba(0, 0, 0, 0.9)',
          m: 2
        }
      }}
    >
      <DialogTitle
        sx={{
          display: 'flex',
          flexDirection: 'column',
          bgcolor: 'rgba(0, 0, 0, 0.8)',
          color: 'white',
          py: 1,
          px: 2,
          gap: 0.5
        }}
      >
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <Typography variant="subtitle1">
              리뷰 이미지 ({(currentIndex + 1).toLocaleString()} / {effectiveTotal.toLocaleString()})
            </Typography>
            {buyerInfo && (
              <Typography variant="body2" sx={{ color: 'grey.400' }}>
                {buyerInfo.buyer_name} {buyerInfo.order_number && `(${buyerInfo.order_number})`}
              </Typography>
            )}
          </Box>
          <IconButton onClick={onClose} sx={{ color: 'white' }} size="small">
            <CloseIcon />
          </IconButton>
        </Box>

        {meta && (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.25, mt: 0.5 }}>
            <Typography variant="body2" sx={{ color: 'grey.300' }}>
              {[
                meta.monthly_brand?.name,
                meta.campaign?.name,
                meta.item?.product_name
              ].filter(Boolean).join(' · ') || '—'}
            </Typography>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
              <Typography variant="body2" sx={{ color: 'grey.100', fontWeight: 500 }}>
                {meta.buyer?.buyer_name || '(구매자 없음)'}
                {meta.buyer?.recipient_name && meta.buyer.recipient_name !== meta.buyer.buyer_name &&
                  ` (수취인 ${meta.buyer.recipient_name})`}
              </Typography>
              {meta.buyer?.order_number && (
                <Typography variant="caption" sx={{ color: 'grey.400' }}>
                  주문 {meta.buyer.order_number}
                </Typography>
              )}
              {meta.buyerImageTotal > 1 && (
                <Chip
                  label={`${meta.buyerImagePosition}/${meta.buyerImageTotal}장`}
                  size="small"
                  sx={{ bgcolor: 'rgba(255,255,255,0.15)', color: '#fff', height: 20, fontSize: 11 }}
                />
              )}
              {meta.buyer?.is_temporary && (
                <Chip label="선 업로드" size="small" sx={{ bgcolor: '#fbc02d', color: '#000', height: 20, fontSize: 11 }} />
              )}
              {isVirtual && !currentImage && (
                <Chip label="로딩 중…" size="small" sx={{ bgcolor: 'rgba(255,255,255,0.1)', color: '#fff', height: 20, fontSize: 11 }} />
              )}
              {currentIndex === effectiveTotal - 1 && (
                <Chip label="마지막 이미지" size="small" sx={{ bgcolor: '#455a64', color: '#fff', height: 20, fontSize: 11 }} />
              )}
            </Box>
          </Box>
        )}
      </DialogTitle>

      <DialogContent
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          p: 0,
          bgcolor: 'rgba(0, 0, 0, 0.9)',
          overflow: 'hidden',
          position: 'relative',
          '& .swiper': { width: '100%', height: '100%' },
          '& .swiper-slide': {
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          },
          '& .swiper-button-prev, & .swiper-button-next': {
            color: 'white',
            backgroundColor: 'rgba(0, 0, 0, 0.5)',
            width: '50px',
            height: '50px',
            borderRadius: '50%',
            '&::after': { fontSize: '20px' },
            '&:hover': { backgroundColor: 'rgba(0, 0, 0, 0.7)' }
          },
          '& .swiper-button-disabled': { opacity: 0.3 }
        }}
      >
        {isVirtual ? (
          <>
            {/* Virtual 모드: 단일 이미지 + 좌우 버튼 */}
            <IconButton
              onClick={handlePrev}
              disabled={currentIndex === 0}
              sx={{
                position: 'absolute',
                left: 12,
                top: '50%',
                transform: 'translateY(-50%)',
                color: 'white',
                bgcolor: 'rgba(0,0,0,0.5)',
                width: 48,
                height: 48,
                zIndex: 2,
                '&:hover': { bgcolor: 'rgba(0,0,0,0.7)' },
                '&.Mui-disabled': { opacity: 0.3, color: 'white' }
              }}
            >
              <ChevronLeftIcon fontSize="large" />
            </IconButton>
            <IconButton
              onClick={handleNext}
              disabled={currentIndex === effectiveTotal - 1}
              sx={{
                position: 'absolute',
                right: 12,
                top: '50%',
                transform: 'translateY(-50%)',
                color: 'white',
                bgcolor: 'rgba(0,0,0,0.5)',
                width: 48,
                height: 48,
                zIndex: 2,
                '&:hover': { bgcolor: 'rgba(0,0,0,0.7)' },
                '&.Mui-disabled': { opacity: 0.3, color: 'white' }
              }}
            >
              <ChevronRightIcon fontSize="large" />
            </IconButton>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '100%', height: '100%' }}>
              {renderSingleImage()}
            </Box>
          </>
        ) : (
          /* Array 모드: 기존 Swiper 유지 (하위 호환) */
          <Swiper
            modules={[Navigation, Keyboard]}
            navigation
            keyboard={{ enabled: true }}
            initialSlide={initialIndex}
            onSwiper={setSwiperInstance}
            onSlideChange={(swiper) => setCurrentIndex(swiper.activeIndex)}
            style={{ width: '100%', height: '100%' }}
          >
            {images.map((image, idx) => (
              <SwiperSlide key={image.id || idx}>
                <img
                  src={image.s3_url || image.url}
                  alt={image.file_name || `이미지 ${idx + 1}`}
                  style={{
                    maxWidth: '100%',
                    maxHeight: 'calc(90vh - 80px)',
                    objectFit: 'contain',
                    userSelect: 'none'
                  }}
                  draggable={false}
                />
              </SwiperSlide>
            ))}
          </Swiper>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default ImageSwipeViewer;
