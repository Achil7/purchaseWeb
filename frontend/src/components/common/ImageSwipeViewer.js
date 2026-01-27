import React, { useState, useEffect, useCallback } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  IconButton,
  Typography,
  Box
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';

// Swiper imports
import { Swiper, SwiperSlide } from 'swiper/react';
import { Navigation, Keyboard } from 'swiper/modules';
import 'swiper/css';
import 'swiper/css/navigation';

/**
 * 이미지 스와이프 뷰어 컴포넌트
 * - 터치 스와이프 지원
 * - 마우스 드래그 지원
 * - 키보드 방향키 지원
 * - 이전/다음 버튼 지원
 *
 * @param {boolean} open - 다이얼로그 열림 상태
 * @param {function} onClose - 닫기 핸들러
 * @param {Array} images - 이미지 배열 [{s3_url, file_name, ...}, ...]
 * @param {number} initialIndex - 시작 이미지 인덱스
 * @param {object} buyerInfo - 구매자 정보 (선택사항)
 */
const ImageSwipeViewer = ({
  open,
  onClose,
  images = [],
  initialIndex = 0,
  buyerInfo = null
}) => {
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const [swiperInstance, setSwiperInstance] = useState(null);

  // initialIndex가 변경되면 해당 슬라이드로 이동
  useEffect(() => {
    if (swiperInstance && open) {
      swiperInstance.slideTo(initialIndex, 0);
      setCurrentIndex(initialIndex);
    }
  }, [initialIndex, open, swiperInstance]);

  // 다이얼로그가 닫힐 때 인덱스 초기화
  useEffect(() => {
    if (!open) {
      setCurrentIndex(initialIndex);
    }
  }, [open, initialIndex]);

  // ESC 키로 닫기
  const handleKeyDown = useCallback((e) => {
    if (e.key === 'Escape') {
      onClose();
    }
  }, [onClose]);

  useEffect(() => {
    if (open) {
      document.addEventListener('keydown', handleKeyDown);
      return () => document.removeEventListener('keydown', handleKeyDown);
    }
  }, [open, handleKeyDown]);

  if (!images || images.length === 0) {
    return null;
  }

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
          justifyContent: 'space-between',
          alignItems: 'center',
          bgcolor: 'rgba(0, 0, 0, 0.8)',
          color: 'white',
          py: 1,
          px: 2
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <Typography variant="subtitle1">
            리뷰 이미지 ({currentIndex + 1} / {images.length})
          </Typography>
          {buyerInfo && (
            <Typography variant="body2" sx={{ color: 'grey.400' }}>
              {buyerInfo.buyer_name} {buyerInfo.order_number && `(${buyerInfo.order_number})`}
            </Typography>
          )}
        </Box>
        <IconButton
          onClick={onClose}
          sx={{ color: 'white' }}
          size="small"
        >
          <CloseIcon />
        </IconButton>
      </DialogTitle>

      <DialogContent
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          p: 0,
          bgcolor: 'rgba(0, 0, 0, 0.9)',
          overflow: 'hidden',
          '& .swiper': {
            width: '100%',
            height: '100%'
          },
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
            '&::after': {
              fontSize: '20px'
            },
            '&:hover': {
              backgroundColor: 'rgba(0, 0, 0, 0.7)'
            }
          },
          '& .swiper-button-disabled': {
            opacity: 0.3
          }
        }}
      >
        <Swiper
          modules={[Navigation, Keyboard]}
          navigation={true}
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
      </DialogContent>
    </Dialog>
  );
};

export default ImageSwipeViewer;
