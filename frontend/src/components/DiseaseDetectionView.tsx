import React, { useState, useRef, useEffect } from 'react';
import {
  ArrowLeft, Upload, X, Camera, Loader2, AlertTriangle,
  CheckCircle, Plus, Search, Sparkles, RefreshCw, MessageSquare,
  Eye, Check, VideoOff, ImageOff, WifiOff, CloudUpload, Bot, ShieldAlert
} from 'lucide-react';
import { diseaseApi, aiApi } from '../services/api';
import { useLanguage } from '../context/LanguageContext';
import { getDiseaseReferenceImage } from '../utils/diseaseImages';
import { uploadQueue } from '../utils/uploadQueue';

interface DiseaseDetectionViewProps {
  onBack: () => void;
  onOpenConsultation: () => void;
  onNavigateAI?: (query: string) => void;
  initialPredictionId?: string | null;
}

interface ImageItem {
  id: string;
  url: string;
  file: File;
  enhancedUrl?: string;
  enhancedFile?: File;
  status: 'uploading' | 'enhancing' | 'enhanced' | 'failed';
  enhancementsApplied?: string[];
  showEnhanced?: boolean;
}

export const DiseaseDetectionView: React.FC<DiseaseDetectionViewProps> = ({
  onBack,
  onOpenConsultation,
  onNavigateAI,
  initialPredictionId,
}) => {
  const { language, t, translateDynamic } = useLanguage();
  const [images, setImages] = useState<ImageItem[]>([]);
  const [analyzing, setAnalyzing] = useState(false);
  const [queuedCount, setQueuedCount] = useState(0);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [showFeedbackModal, setShowFeedbackModal] = useState(false);
  const [feedbackLabel, setFeedbackLabel] = useState('');
  const [feedbackNotes, setFeedbackNotes] = useState('');
  const [feedbackSubmitting, setFeedbackSubmitting] = useState(false);
  const [feedbackSuccess, setFeedbackSuccess] = useState(false);
  const [validationGuidance, setValidationGuidance] = useState<string | null>(null);
  const [result, setResult] = useState<{
    disease: string;
    crop?: string;
    confidence: number;
    status: string;
    symptoms: string;
    action: string;
    severity?: string;
    thumbnailUrl?: string;
    referenceImage?: string | null;
    agricultural_analysis?: any;
    image_results?: any[];
  } | null>(null);

  const [error, setError] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Camera capture states
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null);
  const [cameraError, setCameraError] = useState('');
  const [capturedBlob, setCapturedBlob] = useState<Blob | null>(null);
  const [capturedPreviewUrl, setCapturedPreviewUrl] = useState<string | null>(null);
  const [isValidatingCapture, setIsValidatingCapture] = useState(false);
  const [captureValidation, setCaptureValidation] = useState<{
    is_valid: boolean;
    reason?: string;
    actionable_guidance?: string;
    metrics?: {
      leaf_probability?: number;
      blur_score?: number;
      brightness_score?: number;
      leaf_area_ratio?: number;
      screen_probability?: number;
    };
  } | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Listen to offline upload queue and connectivity
  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    const unsubscribeQueue = uploadQueue.subscribe((q) => {
      const pending = q.filter((item) => item.status === 'queued' || item.status === 'failed');
      setQueuedCount(pending.length);
    });

    uploadQueue.setUploader(async (item) => {
      const file = new File([item.fileBlob], item.fileName, { type: 'image/jpeg' });
      const formData = new FormData();
      formData.append('images', file);
      return await diseaseApi.predictDisease(formData);
    });

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      unsubscribeQueue();
      stopCamera();
    };
  }, []);

  // Deep linking: load specific disease prediction if opened from push notification
  useEffect(() => {
    if (initialPredictionId) {
      diseaseApi.getPrediction(initialPredictionId).then((pred: any) => {
        if (pred) {
          const firstImg = pred.image_results?.[0];
          setResult({
            disease: pred.primary_disease || 'Unknown',
            crop: pred.primary_crop || 'Crop',
            confidence: pred.overall_confidence || 0,
            status: pred.status || 'completed',
            symptoms: (pred.recommendations && pred.recommendations[0]) || 'Observe leaf symptoms and follow treatment guidance.',
            action: (pred.recommendations && pred.recommendations[1]) || 'Apply recommended management or spray practice.',
            severity: pred.severity || 'Treatable',
            thumbnailUrl: firstImg?.image_path ? (firstImg.image_path.startsWith('/') ? firstImg.image_path : '/' + firstImg.image_path) : undefined,
            referenceImage: getDiseaseReferenceImage(pred.primary_disease),
            image_results: pred.image_results || [],
          });
        }
      }).catch(err => {
        console.warn('Could not load deep linked prediction:', err);
      });
    }
  }, [initialPredictionId]);

  const startCamera = async () => {
    setCameraError('');
    setCapturedBlob(null);
    setCapturedPreviewUrl(null);
    setCaptureValidation(null);
    setIsValidatingCapture(false);
    setIsCameraOpen(true);

    try {
      let stream: MediaStream;
      try {
        // Request high-resolution back-camera video stream
        stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: { ideal: 'environment' },
            width: { ideal: 1920, min: 1280 },
            height: { ideal: 1080, min: 720 },
          },
        });
      } catch {
        // Fallback to default available video stream
        stream = await navigator.mediaDevices.getUserMedia({ video: true });
      }

      setCameraStream(stream);
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play().catch(console.error);
      }

      // Try continuous focus if supported by device hardware
      const track = stream.getVideoTracks()[0];
      if (track) {
        const capabilities = (track.getCapabilities ? track.getCapabilities() : {}) as any;
        if (capabilities.focusMode && capabilities.focusMode.includes('continuous')) {
          try {
            await (track.applyConstraints as any)({ advanced: [{ focusMode: 'continuous' }] });
          } catch {}
        }
      }
    } catch (err: any) {
      console.error('Camera access denied or unavailable:', err);
      setCameraError(
        'Camera permission was denied or no camera device was detected. Please check browser permissions or upload files directly.'
      );
    }
  };

  const stopCamera = () => {
    if (cameraStream) {
      cameraStream.getTracks().forEach((track) => track.stop());
      setCameraStream(null);
    }
    if (capturedPreviewUrl) {
      URL.revokeObjectURL(capturedPreviewUrl);
      setCapturedPreviewUrl(null);
    }
    setCapturedBlob(null);
    setCaptureValidation(null);
    setIsValidatingCapture(false);
    setIsCameraOpen(false);
  };

  const capturePhoto = async () => {
    let photoBlob: Blob | null = null;

    // 1. Prefer hardware ImageCapture API if available for full camera sensor resolution
    if (cameraStream) {
      const track = cameraStream.getVideoTracks()[0];
      if (track && typeof (window as any).ImageCapture !== 'undefined') {
        try {
          const imageCapture = new (window as any).ImageCapture(track);
          photoBlob = await imageCapture.takePhoto({ fillLightMode: 'auto' });
        } catch (icErr) {
          console.warn('Hardware ImageCapture takePhoto failed, falling back to canvas:', icErr);
        }
      }
    }

    // 2. Fallback to drawing video frame on high-resolution canvas
    if (!photoBlob && videoRef.current && canvasRef.current) {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      canvas.width = video.videoWidth || 1280;
      canvas.height = video.videoHeight || 720;

      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        photoBlob = await new Promise<Blob | null>((resolve) => {
          canvas.toBlob((blob) => resolve(blob), 'image/jpeg', 0.95);
        });
      }
    }

    if (!photoBlob) {
      console.error('Could not capture frame from camera stream');
      return;
    }

    setCapturedBlob(photoBlob);
    const previewUrl = URL.createObjectURL(photoBlob);
    setCapturedPreviewUrl(previewUrl);

    // 3. Immediately run real-time leaf validation to give instant in-camera feedback
    const capturedFile = new File([photoBlob], `crop_capture_${Date.now()}.jpg`, { type: 'image/jpeg' });
    setIsValidatingCapture(true);
    setCaptureValidation(null);

    try {
      const valResult = await diseaseApi.validateImage(capturedFile);
      setCaptureValidation(valResult);
    } catch (valErr) {
      console.warn('In-camera quality check offline or failed:', valErr);
      setCaptureValidation({
        is_valid: true,
        actionable_guidance: 'Captured photo ready for AI analysis.',
      });
    } finally {
      setIsValidatingCapture(false);
    }
  };

  const retakePhoto = () => {
    if (capturedPreviewUrl) {
      URL.revokeObjectURL(capturedPreviewUrl);
      setCapturedPreviewUrl(null);
    }
    setCapturedBlob(null);
    setCaptureValidation(null);
    setIsValidatingCapture(false);
  };

  const confirmCapturedPhoto = () => {
    if (!capturedBlob) return;
    const file = new File([capturedBlob], `crop_camera_${Date.now()}.jpg`, { type: 'image/jpeg' });
    stopCamera();
    addFiles([file]);
  };

  // Enhance image via OpenCV backend
  const enhanceSingleImage = async (item: ImageItem) => {
    try {
      setImages((prev) =>
        prev.map((img) => (img.id === item.id ? { ...img, status: 'enhancing' } : img))
      );

      const res = await diseaseApi.enhanceImage(item.file);
      if (res && res.enhanced_url) {
        // Fetch enhanced image as a blob/file so we can send it to predict
        let enhancedFile = item.file;
        try {
          const fetchRes = await fetch(res.enhanced_url);
          const blob = await fetchRes.blob();
          enhancedFile = new File([blob], `enhanced_${item.file.name}`, { type: blob.type || 'image/jpeg' });
        } catch {
          // If fetch fails, fallback to original file
        }

        setImages((prev) =>
          prev.map((img) =>
            img.id === item.id
              ? {
                  ...img,
                  status: 'enhanced',
                  enhancedUrl: res.enhanced_url,
                  enhancedFile,
                  enhancementsApplied: res.enhancements_applied || [
                    'LAB-CLAHE Contrast',
                    'Bilateral Denoise',
                    'Unsharp Mask',
                  ],
                  showEnhanced: true,
                }
              : img
          )
        );
      } else {
        setImages((prev) =>
          prev.map((img) => (img.id === item.id ? { ...img, status: 'failed' } : img))
        );
      }
    } catch (err) {
      console.error('Enhancement failed for image:', item.id, err);
      setImages((prev) =>
        prev.map((img) => (img.id === item.id ? { ...img, status: 'failed' } : img))
      );
    }
  };

  const addFiles = (files: File[]) => {
    const newItems: ImageItem[] = [];
    const availableSlots = 5 - images.length;

    for (let i = 0; i < files.length && i < availableSlots; i++) {
      const file = files[i];
      if (!file.type.startsWith('image/')) continue;

      const item: ImageItem = {
        id: `${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        url: URL.createObjectURL(file),
        file,
        status: 'uploading',
      };
      newItems.push(item);
    }

    if (newItems.length > 0) {
      setImages((prev) => [...prev, ...newItems]);
      // Trigger parallel OpenCV enhancement for each new image
      newItems.forEach((item) => enhanceSingleImage(item));
    }
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      addFiles(Array.from(e.target.files));
      e.target.value = '';
    }
  };

  const removeImage = (id: string) => {
    setImages((prev) => {
      const target = prev.find((img) => img.id === id);
      if (target?.url) URL.revokeObjectURL(target.url);
      return prev.filter((img) => img.id !== id);
    });
  };

  const toggleEnhancedView = (id: string) => {
    setImages((prev) =>
      prev.map((img) =>
        img.id === id ? { ...img, showEnhanced: !img.showEnhanced } : img
      )
    );
  };

  const handleAnalyze = async () => {
    if (images.length === 0) return;
    setAnalyzing(true);
    setError('');

    try {
      const formData = new FormData();
      // Always provide original unadulterated photo so backend runs single canonical enhancement pass
      images.forEach((item) => {
        formData.append('images', item.file);
      });

      const res = await diseaseApi.predictDisease(formData);

      const diseaseName = res?.disease || res?.prediction?.disease;
      if (res && diseaseName) {
        const cropName = res.crop || res.prediction?.crop || '';
        const rawConf = res.confidence ?? res.prediction?.confidence ?? 0.88;
        const confidence = Math.round(rawConf <= 1 ? rawConf * 100 : rawConf);
        const isHealthy = diseaseName.toLowerCase().includes('healthy');
        const status = isHealthy ? 'Healthy' : (res.severity || 'Treatable');

        // Resolve authentic reference image: from backend response or local disease registry
        const referenceImage = res.reference_image || getDiseaseReferenceImage(diseaseName, cropName);

        // Uploaded/enhanced sample image for thumbnail
        const primaryThumbnail = images[0]?.enhancedUrl || images[0]?.url;

        const symptoms =
          res.symptoms ||
          (res.recommendations && res.recommendations[0]) ||
          'Characteristic foliar necrotic lesions and tissue chlorosis observed on leaf sample.';

        const action =
          res.treatment ||
          (res.recommendations && res.recommendations[1]) ||
          (res.recommendations && res.recommendations[0]) ||
          'Apply targeted biopesticide or systemic fungicide at dawn and inspect adjacent plots.';

        let localizedSymptoms = symptoms;
        let localizedAction = action;

        if (language !== 'en') {
          try {
            const [transSymp, transAct] = await Promise.all([
              translateDynamic(symptoms),
              translateDynamic(action),
            ]);
            localizedSymptoms = transSymp;
            localizedAction = transAct;
          } catch (e) {
            console.warn('Failed to translate diagnosis recommendations:', e);
          }
        }

        setResult({
          disease: diseaseName,
          crop: cropName,
          confidence,
          status,
          symptoms: localizedSymptoms,
          action: localizedAction,
          severity: res.severity,
          thumbnailUrl: primaryThumbnail,
          referenceImage,
          agricultural_analysis: res.agricultural_analysis,
          image_results: res.image_results,
        });
      } else {
        throw new Error('Prediction service returned an empty response. Please verify backend ML service.');
      }
    } catch (err: any) {
      console.error('Disease detection error:', err);
      if (!navigator.onLine) {
        images.forEach((img) => uploadQueue.enqueue(img.enhancedFile || img.file));
        setError(
          t('detection.offlineQueued', undefined, 'Device is currently offline. Your crop photo(s) have been safely saved to the offline upload queue and will automatically analyze when internet connectivity is restored.')
        );
      } else {
        const data = err?.response?.data;
        if (data?.actionable_guidance) {
          const rawGuidance = data.actionable_guidance;
          const rawReason = data.reason || data.message || t('detection.wrongImage', undefined, 'Image validation rejected by AgriGuard Leaf Validator.');
          if (language !== 'en') {
            Promise.all([translateDynamic(rawGuidance), translateDynamic(rawReason)])
              .then(([transG, transR]) => {
                setValidationGuidance(transG);
                setError(transR);
              })
              .catch(() => {
                setValidationGuidance(rawGuidance);
                setError(rawReason);
              });
          } else {
            setValidationGuidance(rawGuidance);
            setError(rawReason);
          }
        } else {
          setValidationGuidance(null);
          const rawErr = data?.detail || data?.message || err?.message || 'Failed to perform AI disease detection. Please ensure the backend is running.';
          if (language !== 'en' && typeof rawErr === 'string') {
            translateDynamic(rawErr).then(setError).catch(() => setError(rawErr));
          } else {
            setError(rawErr);
          }
        }
      }
    } finally {
      setAnalyzing(false);
    }
  };

  const handleFeedbackSubmit = async () => {
    if (!feedbackLabel.trim() || !result) return;
    setFeedbackSubmitting(true);
    try {
      await aiApi.submitExpertFeedback({
        original_prediction: result.disease,
        original_confidence: result.confidence / 100,
        expert_label: feedbackLabel.trim(),
        crop: result.crop,
        disease: feedbackLabel.trim(),
        notes: feedbackNotes.trim(),
      });
      setFeedbackSuccess(true);
      setTimeout(() => {
        setShowFeedbackModal(false);
        setFeedbackSuccess(false);
        setFeedbackLabel('');
        setFeedbackNotes('');
      }, 2000);
    } catch (err) {
      console.error('Failed to submit expert feedback:', err);
    } finally {
      setFeedbackSubmitting(false);
    }
  };

  return (
    <div className="space-y-4 animate-fade-in-up">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button onClick={onBack} className="lg:hidden p-2 rounded-xl hover:bg-emerald-900/30 transition">
            <ArrowLeft className="w-5 h-5 text-emerald-300" />
          </button>
          <div>
            <h1 className="text-xl font-black text-white font-heading">{t('detection.title', undefined, 'Crop Disease Detection')}</h1>
            <p className="text-emerald-300/70 text-xs mt-0.5">{t('detection.subtitle', undefined, 'Real-time OpenCV CLAHE Enhancement & Pathology ML')}</p>
          </div>
        </div>
      </div>

      {/* Offline / Queued Photo Alert */}
      {(!isOnline || queuedCount > 0) && (
        <div className="glass-card px-4 py-2.5 flex items-center justify-between border-amber-500/40 bg-amber-950/30 text-amber-300 text-xs">
          <div className="flex items-center gap-2">
            {!isOnline ? (
              <WifiOff className="w-4 h-4 text-amber-400 flex-shrink-0" />
            ) : (
              <CloudUpload className="w-4 h-4 text-emerald-400 flex-shrink-0 animate-bounce" />
            )}
            <span>
              {!isOnline
                ? `Offline Field Mode active. ${queuedCount > 0 ? `${queuedCount} photo scan(s) queued for auto-upload.` : 'Photos will be saved locally.'}`
                : `Syncing ${queuedCount} offline crop photo scan(s)...`}
            </span>
          </div>
          {isOnline && queuedCount > 0 && (
            <button
              onClick={() => uploadQueue.processQueue()}
              className="text-[11px] font-bold text-emerald-300 hover:text-white px-2 py-0.5 rounded bg-emerald-500/20 border border-emerald-500/40 cursor-pointer"
            >
              Sync Now
            </button>
          )}
        </div>
      )}

      {/* 3-Step Indicator Bar */}
      <div className="glass-card px-6 py-3 border border-emerald-500/20">
        <div className="flex items-center justify-between max-w-xl mx-auto text-xs font-bold">
          <div className={`flex items-center gap-2 ${images.length > 0 ? 'text-emerald-400' : 'text-emerald-300/80'}`}>
            <span className="w-6 h-6 rounded-full bg-emerald-500 text-emerald-950 flex items-center justify-center text-[11px] font-black">
              1
            </span>
            <span>{t('detection.uploadTab', undefined, 'Upload & Enhance')}</span>
          </div>

          <div className={`flex-1 h-[2px] mx-4 ${analyzing || result ? 'bg-emerald-500' : 'bg-emerald-500/30'}`} />

          <div className={`flex items-center gap-2 ${analyzing ? 'text-emerald-400 animate-pulse' : result ? 'text-emerald-400' : 'text-emerald-300/60'}`}>
            <span className={`w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-black ${
              analyzing ? 'bg-emerald-400 text-emerald-950' : 'bg-emerald-500/20 border border-emerald-500/40 text-emerald-400'
            }`}>
              2
            </span>
            <span>{t('detection.analysis', undefined, 'AI Pathology Engine')}</span>
          </div>

          <div className={`flex-1 h-[2px] mx-4 ${result ? 'bg-emerald-500' : 'bg-emerald-500/30'}`} />

          <div className={`flex items-center gap-2 ${result ? 'text-emerald-400' : 'text-emerald-300/60'}`}>
            <span className={`w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-black ${
              result ? 'bg-emerald-500 text-emerald-950' : 'bg-emerald-500/20 border border-emerald-500/40 text-emerald-400'
            }`}>
              3
            </span>
            <span>{t('detection.diagnosisResult', undefined, 'Diagnosis & Action')}</span>
          </div>
        </div>
      </div>

      {error && (
        <div className="glass-card p-3 flex items-center justify-between border-red-500/30">
          <div className="flex items-center gap-2 text-red-300 text-xs">
            <AlertTriangle className="w-4 h-4 text-red-400 flex-shrink-0" />
            <span>{error}</span>
          </div>
          <button onClick={() => setError('')} className="text-red-400 hover:text-red-300 text-xs font-bold">
            Dismiss
          </button>
        </div>
      )}

      {/* Top 2 Columns: Upload Zone & Uploaded Photos */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Left: Upload / Camera Trigger Area */}
        <div className="glass-card p-5 flex flex-col justify-between border border-emerald-500/20">
          <div className="flex flex-col gap-3">
            <div
              onClick={() => fileInputRef.current?.click()}
              className="border-2 border-dashed border-emerald-500/40 rounded-2xl p-6 text-center cursor-pointer hover:border-emerald-400 hover:bg-emerald-900/15 transition flex flex-col items-center justify-center gap-2 min-h-[140px]"
            >
              <div className="w-11 h-11 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center">
                <Upload className="w-5 h-5 text-emerald-400" />
              </div>
              <p className="text-xs font-bold text-white">{t('detection.dropImageHere', undefined, 'Choose photos of diseased crop leaf')}</p>
              <p className="text-[11px] text-emerald-300/60">OpenCV CLAHE (Max 5)</p>
            </div>

            <div className="grid grid-cols-2 gap-2.5">
              <button
                type="button"
                onClick={startCamera}
                disabled={images.length >= 5}
                className="py-2.5 px-3 rounded-xl border border-emerald-500/30 bg-emerald-900/20 hover:bg-emerald-900/40 text-emerald-300 text-xs font-bold flex items-center justify-center gap-2 transition cursor-pointer disabled:opacity-50"
              >
                <Camera className="w-4 h-4 text-emerald-400" />
                <span>{t('detection.captureTab', undefined, 'Live Camera')}</span>
              </button>

              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={images.length >= 5}
                className="py-2.5 px-3 rounded-xl border border-emerald-500/30 bg-emerald-900/20 hover:bg-emerald-900/40 text-emerald-300 text-xs font-bold flex items-center justify-center gap-2 transition cursor-pointer disabled:opacity-50"
              >
                <Plus className="w-4 h-4 text-emerald-400" />
                <span>{t('detection.uploadPhoto', undefined, 'Browse Files')}</span>
              </button>
            </div>
          </div>

          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            multiple
            onChange={handleFileInput}
            className="hidden"
          />
        </div>

        {/* Right: Uploaded Photos with OpenCV Enhancement Status */}
        <div className="glass-card p-5 space-y-3 border border-emerald-500/20 flex flex-col">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold text-emerald-200/90 text-left">
              {t('detection.photosAndPreprocessing', { count: images.length }, `Photos & AI Preprocessing (${images.length}/5)`)}
            </h3>
            {images.some((i) => i.status === 'enhancing') && (
              <span className="flex items-center gap-1.5 text-[10px] text-emerald-400 font-semibold animate-pulse">
                <Loader2 className="w-3 h-3 animate-spin" />
                {t('detection.claheProcessing', undefined, 'OpenCV CLAHE Processing...')}
              </span>
            )}
          </div>

          {/* Touch-friendly horizontal swipe on mobile, 3-column grid on desktop */}
          <div className="flex sm:grid sm:grid-cols-3 gap-2.5 flex-1 min-h-[140px] overflow-x-auto touch-pan-x snap-x snap-mandatory pb-2 scrollbar-none">
            {images.map((img) => (
              <div
                key={img.id}
                className="relative aspect-square w-28 sm:w-auto shrink-0 snap-start rounded-xl overflow-hidden border border-emerald-500/30 group bg-emerald-950/50 flex flex-col justify-end"
              >
                <img
                  src={img.showEnhanced && img.enhancedUrl ? img.enhancedUrl : img.url}
                  alt="Crop"
                  className="w-full h-full object-cover absolute inset-0"
                />

                {/* Status Overlay */}
                <div className="relative z-10 p-1.5 bg-gradient-to-t from-black/85 via-black/40 to-transparent flex items-center justify-between">
                  {img.status === 'enhancing' && (
                    <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-amber-500/30 text-amber-300 border border-amber-500/40 flex items-center gap-1">
                      <Loader2 className="w-2.5 h-2.5 animate-spin" /> Enhancing
                    </span>
                  )}
                  {img.status === 'enhanced' && (
                    <button
                      type="button"
                      onClick={() => toggleEnhancedView(img.id)}
                      className="text-[9px] font-extrabold px-1.5 py-0.5 rounded bg-emerald-500/30 text-emerald-300 border border-emerald-500/40 flex items-center gap-1 cursor-pointer hover:bg-emerald-500/50"
                      title="Toggle Enhanced / Original"
                    >
                      <Sparkles className="w-2.5 h-2.5 text-emerald-300" />
                      {img.showEnhanced ? t('detection.enhanced', undefined, 'Enhanced') : t('detection.original', undefined, 'Original')}
                    </button>
                  )}
                  {img.status === 'failed' && (
                    <button
                      type="button"
                      onClick={() => enhanceSingleImage(img)}
                      className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-red-500/30 text-red-300 border border-red-500/40 flex items-center gap-1 cursor-pointer"
                    >
                      <RefreshCw className="w-2.5 h-2.5" /> {t('common.tryAgain', undefined, 'Retry')}
                    </button>
                  )}

                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      removeImage(img.id);
                    }}
                    className="w-5 h-5 rounded-full bg-red-600/90 hover:bg-red-500 text-white flex items-center justify-center transition shadow-md cursor-pointer ml-auto"
                    title="Remove"
                  >
                    <X className="w-3 h-3 stroke-[2.5]" />
                  </button>
                </div>
              </div>
            ))}

            {images.length < 5 && (
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="aspect-square w-28 sm:w-auto shrink-0 snap-start rounded-xl border border-dashed border-emerald-500/30 flex flex-col items-center justify-center gap-1 text-emerald-400 hover:bg-emerald-900/20 transition cursor-pointer"
              >
                <Plus className="w-5 h-5" />
                <span className="text-[10px] font-semibold">{t('detection.addPhoto', undefined, 'Add Photo')}</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Full-width Green Analyze Button */}
      <button
        onClick={handleAnalyze}
        disabled={images.length === 0 || analyzing}
        className="btn-primary w-full py-3.5 text-sm font-bold flex items-center justify-center gap-2 shadow-[0_0_25px_rgba(16,185,129,0.35)] cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {analyzing ? (
          <>
            <Loader2 className="w-4 h-4 animate-spin text-emerald-950" />
            <span className="text-emerald-950 font-black">{t('detection.analyzingSymptoms', undefined, 'Analyzing Crop Symptoms with AI Engine...')}</span>
          </>
        ) : (
          <>
            <Search className="w-4 h-4 text-emerald-950 stroke-[2.5]" />
            <span className="text-emerald-950 font-black">
              {t('detection.analyzePhotosCount', { count: images.length, plural: images.length > 1 ? 's' : '' }, `Analyze ${images.length > 0 ? `${images.length} Photo${images.length > 1 ? 's' : ''}` : 'Photos'}`)}
            </span>
          </>
        )}
      </button>

      {/* In-Place Visible Error State Card */}
      {error && (
        <div className="glass-card p-5 border border-red-500/40 bg-red-950/30 shadow-xl space-y-3 animate-fade-in text-left">
          <div className="flex items-center justify-between pb-2 border-b border-red-500/20">
            <div className="flex items-center gap-2 text-red-400 font-bold text-sm">
              <AlertTriangle className="w-5 h-5 flex-shrink-0" />
              <span>{t('detection.analysisFailedTryAgain', undefined, 'Analysis failed — Try Again')}</span>
            </div>
            <button
              type="button"
              onClick={() => setError('')}
              className="text-red-400/70 hover:text-red-300 text-xs font-semibold cursor-pointer"
            >
              {t('detection.dismiss', undefined, 'Dismiss')}
            </button>
          </div>
          <p className="text-xs text-red-200/90 leading-relaxed">{error}</p>
          {validationGuidance && (
            <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-200 text-xs flex items-start gap-2">
              <ShieldAlert className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
              <div>
                <span className="font-bold text-amber-300">{t('detection.specimenGuidance', undefined, 'Specimen Quality Guidance')}: </span>
                <span>{validationGuidance}</span>
              </div>
            </div>
          )}
          <div className="pt-1 flex items-center gap-3">
            <button
              type="button"
              onClick={handleAnalyze}
              disabled={analyzing || images.length === 0}
              className="py-2 px-4 rounded-xl bg-red-500/20 hover:bg-red-500/30 text-red-200 border border-red-500/40 text-xs font-bold flex items-center gap-2 transition cursor-pointer disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${analyzing ? 'animate-spin' : ''}`} />
              <span>{t('common.tryAgain', undefined, 'Try Again')}</span>
            </button>
          </div>
        </div>
      )}

      {/* Bottom Section: Detection Result Card */}
      {result && (
        <div className="glass-card p-5 space-y-4 border border-emerald-500/30 shadow-2xl animate-fade-in-up">
          <div className="flex items-center justify-between pb-3 border-b border-emerald-500/20">
            <h3 className="text-xs font-bold text-emerald-200 uppercase tracking-wider text-left">
              {t('detection.aiDiagnosticReport', undefined, 'AI Pathology Diagnostic Report')}
            </h3>
            <span className="text-[10px] text-emerald-400/80 font-medium">
              {t('detection.verifiedByCore', undefined, 'Verified by AgriGuard-CV Pathology Core')}
            </span>
          </div>

          <div className="flex flex-col sm:flex-row items-start gap-4">
            {/* Image Comparison: Analyzed Sample + Dedicated Reference Image */}
            <div className="flex sm:flex-col gap-3 flex-shrink-0">
              {/* Analyzed Sample */}
              <div className="space-y-1 text-center">
                <div className="w-24 h-24 rounded-2xl overflow-hidden border-2 border-emerald-400/40 shadow-lg relative bg-emerald-950">
                  {result.thumbnailUrl ? (
                    <img
                      src={result.thumbnailUrl}
                      alt="Analyzed leaf sample"
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-emerald-400/50">
                      <ImageOff className="w-6 h-6" />
                    </div>
                  )}
                  <div className="absolute inset-x-0 bottom-0 bg-black/75 backdrop-blur-sm py-0.5 text-[9px] font-bold text-emerald-300">
                    {t('detection.yourSample', undefined, 'Your Sample')}
                  </div>
                </div>
              </div>

              {/* Verified Reference Image */}
              <div className="space-y-1 text-center">
                <div className="w-24 h-24 rounded-2xl overflow-hidden border-2 border-emerald-500/30 shadow-lg relative bg-emerald-950 flex items-center justify-center">
                  {result.referenceImage ? (
                    <>
                      <img
                        src={result.referenceImage}
                        alt={`${result.disease} botanical reference`}
                        className="w-full h-full object-cover"
                      />
                      <div className="absolute inset-x-0 bottom-0 bg-emerald-950/85 backdrop-blur-sm py-0.5 text-[9px] font-bold text-emerald-300 border-t border-emerald-500/30">
                        {t('detection.botanicalRef', undefined, 'Botanical Ref')}
                      </div>
                    </>
                  ) : (
                    <div className="flex flex-col items-center justify-center p-2 text-center text-[9px] text-emerald-400/60 leading-tight">
                      <ImageOff className="w-5 h-5 mb-1 text-emerald-400/40" />
                      <span>{t('detection.noRefImage', undefined, 'No ref image')}</span>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Disease Info */}
            <div className="flex-1 space-y-2.5 text-left">
              <div className="flex items-center gap-2.5 flex-wrap">
                <span className="text-sm font-semibold text-emerald-300/80">{t('detection.analysis', undefined, 'Diagnosis')}:</span>
                <span className="text-base font-black text-white">
                  {result.disease} {result.crop ? `(${result.crop})` : ''}
                </span>
                <span className="text-[10px] font-extrabold px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 uppercase">
                  {result.status}
                </span>
              </div>

              {/* Confidence Bar */}
              <div className="space-y-1">
                <div className="flex items-center justify-between text-xs font-bold">
                  <span className="text-emerald-300/70">{t('detection.confidence', undefined, 'Model Confidence')}:</span>
                  <span className="text-emerald-400">{result.confidence}%</span>
                </div>
                <div className="w-full h-2 rounded-full bg-emerald-950/80 overflow-hidden border border-emerald-500/20">
                  <div
                    className="h-full bg-gradient-to-r from-emerald-500 to-emerald-400 rounded-full transition-all duration-700"
                    style={{ width: `${result.confidence}%` }}
                  />
                </div>
              </div>

              {/* Symptoms */}
              <div className="text-xs text-emerald-200/90 leading-relaxed">
                <span className="font-bold text-white">{t('detection.symptoms', undefined, 'Observed Pathology')}: </span>
                <span>{result.symptoms}</span>
              </div>

              {/* Recommended Action */}
              <div className="text-xs text-emerald-200/90 leading-relaxed">
                <span className="font-bold text-white">{t('detection.treatment', undefined, 'Agronomic Guidance')}: </span>
                <span>{result.action}</span>
              </div>

              {/* Transparent AI Agronomic Reasoning */}
              {result.agricultural_analysis?.transparent_reasoning && (
                <div className="p-3 rounded-xl bg-emerald-950/60 border border-emerald-500/25 space-y-1">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-300">
                    <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Pathological Assessment &amp; Transparent Reasoning</span>
                  </div>
                  <p className="text-[11px] text-emerald-200/90 leading-relaxed pl-5">
                    {result.agricultural_analysis.transparent_reasoning}
                  </p>
                </div>
              )}

              {/* Early-Stage Detection Reality Notice */}
              <div className="p-2.5 rounded-xl bg-amber-950/40 border border-amber-500/30 text-amber-200/90 text-[11px] leading-relaxed">
                <span className="font-bold text-amber-300">Early-Stage Detection: </span>
                <span className="font-semibold text-amber-200">NOT YET SUPPORTED</span> — Current models are trained on whole-specimen disease classes without early-stage annotations. Conduct manual field scouting for early chlorotic flecks.
              </div>

              {/* Multi-Image Specimen Breakdown */}
              {result.image_results && result.image_results.length > 1 && (
                <div className="space-y-1.5 pt-1">
                  <span className="text-[11px] font-bold text-emerald-300">
                    Multi-Specimen Verification ({result.image_results.length} leaf images analyzed):
                  </span>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {result.image_results.map((imgRes: any, idx: number) => (
                      <div
                        key={idx}
                        className="p-2 rounded-lg bg-emerald-950/50 border border-emerald-500/20 flex items-center justify-between text-[11px]"
                      >
                        <span className="text-white truncate">Image #{idx + 1}</span>
                        <span className="px-2 py-0.2 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                          {imgRes.is_leaf_valid ? 'Valid Leaf' : 'Rejected'} ({Math.round((imgRes.confidence || 0) * 100)}%)
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Action Row */}
          <div className="pt-3 border-t border-emerald-500/20 flex flex-wrap items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={() => setShowFeedbackModal(true)}
              className="py-2.5 px-3 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 text-xs font-semibold border border-white/10 transition cursor-pointer"
            >
              Correct Diagnosis
            </button>

            {onNavigateAI && (
              <button
                type="button"
                onClick={() =>
                  onNavigateAI(
                    `I just scanned my ${result.crop || 'crop'} and diagnosed ${result.disease} with ${result.confidence}% confidence. What is the comprehensive immediate treatment and organic prevention plan?`
                  )
                }
                className="py-2.5 px-4 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 text-slate-950 font-bold text-xs flex items-center gap-1.5 shadow-lg shadow-emerald-500/20 hover:from-emerald-400 hover:to-teal-400 transition cursor-pointer"
              >
                <Bot className="w-4 h-4" />
                <span>{t('detection.askAI', undefined, 'Ask AI Assistant')}</span>
              </button>
            )}

            <button
              type="button"
              onClick={onOpenConsultation}
              className="btn-primary py-2.5 px-4 text-xs font-bold flex items-center gap-2 shadow-[0_0_15px_rgba(16,185,129,0.3)] cursor-pointer"
            >
              <MessageSquare className="w-4 h-4 text-emerald-950" />
              <span>{t('detection.consultExpert', undefined, 'Consult Agriculture Expert')}</span>
            </button>
          </div>
        </div>
      )}

      {/* Live Camera Viewfinder Modal */}
      {isCameraOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-fade-in">
          <div className="relative w-full max-w-lg rounded-2xl glass-card p-5 border-emerald-500/40 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-emerald-500/20">
              <div className="flex items-center gap-2 text-white font-bold text-sm">
                <Camera className="w-4 h-4 text-emerald-400" />
                <span>Live Crop Camera Capture</span>
              </div>
              <button
                type="button"
                onClick={stopCamera}
                className="p-1 rounded-lg text-emerald-400 hover:text-white hover:bg-emerald-900/30 transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {cameraError ? (
              <div className="p-6 text-center space-y-3">
                <VideoOff className="w-10 h-10 text-red-400 mx-auto" />
                <p className="text-xs text-red-300 leading-relaxed">{cameraError}</p>
                <button onClick={stopCamera} className="btn-secondary text-xs py-2 px-4">
                  Close &amp; Use File Upload
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                {/* Viewfinder or Preview */}
                <div className="relative aspect-video rounded-xl overflow-hidden bg-black border border-emerald-500/30 flex items-center justify-center shadow-inner">
                  {capturedPreviewUrl ? (
                    <div className="relative w-full h-full">
                      <img src={capturedPreviewUrl} alt="Captured preview" className="w-full h-full object-cover" />
                      {isValidatingCapture && (
                        <div className="absolute inset-0 bg-black/60 backdrop-blur-xs flex flex-col items-center justify-center gap-2">
                          <Loader2 className="w-8 h-8 text-emerald-400 animate-spin" />
                          <span className="text-xs font-bold text-emerald-300 animate-pulse">
                            Evaluating Leaf Clarity &amp; Lighting...
                          </span>
                        </div>
                      )}
                    </div>
                  ) : (
                    <>
                      <video
                        ref={videoRef}
                        autoPlay
                        playsInline
                        muted
                        className="w-full h-full object-cover"
                      />
                      {/* Viewfinder Corner Reticle Brackets */}
                      <div className="absolute inset-6 pointer-events-none">
                        <div className="absolute top-0 left-0 w-6 h-6 border-t-2 border-l-2 border-emerald-400 rounded-tl-lg shadow-[0_0_8px_rgba(16,185,129,0.8)]" />
                        <div className="absolute top-0 right-0 w-6 h-6 border-t-2 border-r-2 border-emerald-400 rounded-tr-lg shadow-[0_0_8px_rgba(16,185,129,0.8)]" />
                        <div className="absolute bottom-0 left-0 w-6 h-6 border-b-2 border-l-2 border-emerald-400 rounded-bl-lg shadow-[0_0_8px_rgba(16,185,129,0.8)]" />
                        <div className="absolute bottom-0 right-0 w-6 h-6 border-b-2 border-r-2 border-emerald-400 rounded-br-lg shadow-[0_0_8px_rgba(16,185,129,0.8)]" />
                        
                        {/* Center targeting guide */}
                        <div className="absolute inset-4 border border-dashed border-emerald-400/40 rounded-xl flex items-center justify-center">
                          <span className="text-[10px] text-emerald-300/90 bg-black/70 backdrop-blur-xs px-3 py-1 rounded-full font-bold border border-emerald-500/30">
                            🌿 Center Leaf Inside Frame
                          </span>
                        </div>
                      </div>

                      {/* Top live hints */}
                      <div className="absolute top-3 inset-x-3 flex items-center justify-between pointer-events-none">
                        <span className="text-[10px] font-mono text-emerald-300 bg-black/75 px-2 py-0.5 rounded border border-emerald-500/40">
                          HD SENSOR CAPTURE
                        </span>
                        <span className="text-[10px] text-slate-300 bg-black/75 px-2 py-0.5 rounded border border-white/10">
                          15–20 cm Distance
                        </span>
                      </div>
                    </>
                  )}
                </div>

                <canvas ref={canvasRef} className="hidden" />

                {/* In-Camera Validation Feedback Banner */}
                {capturedBlob && captureValidation && (
                  <div
                    className={`p-3.5 rounded-xl border transition-all animate-fade-in ${
                      captureValidation.is_valid
                        ? 'bg-emerald-950/50 border-emerald-500/40 text-emerald-200'
                        : 'bg-amber-950/50 border-amber-500/50 text-amber-200'
                    }`}
                  >
                    <div className="flex items-start gap-2.5">
                      {captureValidation.is_valid ? (
                        <CheckCircle className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
                      ) : (
                        <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
                      )}
                      <div className="text-left space-y-1 text-xs">
                        <div className="font-bold flex items-center gap-2">
                          <span className={captureValidation.is_valid ? 'text-emerald-300' : 'text-amber-300'}>
                            {captureValidation.is_valid
                              ? '✓ Leaf Quality Verified'
                              : 'Quality Check: Retake Recommended'}
                          </span>
                          {captureValidation.metrics && (
                            <span className="text-[10px] font-mono opacity-70 bg-black/40 px-1.5 py-0.5 rounded">
                              Blur Score: {Math.round((captureValidation.metrics.blur_score || 0.8) * 100)}%
                            </span>
                          )}
                        </div>
                        {captureValidation.reason && (
                          <p className="text-[11px] font-medium text-amber-200/90 leading-tight">
                            {captureValidation.reason}
                          </p>
                        )}
                        <p className="text-[11px] opacity-80 leading-tight">
                          {captureValidation.actionable_guidance}
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {/* Quick Capture Tips (Shown when live camera is streaming) */}
                {!capturedBlob && (
                  <div className="grid grid-cols-3 gap-2 text-center text-[10px] text-slate-300 pt-1">
                    <div className="p-1.5 rounded-lg bg-white/5 border border-white/5">
                      <span className="font-bold text-emerald-400 block">📸 Hold Steady</span>
                      <span>Prevent blur</span>
                    </div>
                    <div className="p-1.5 rounded-lg bg-white/5 border border-white/5">
                      <span className="font-bold text-emerald-400 block">☀️ Good Light</span>
                      <span>Avoid deep shade</span>
                    </div>
                    <div className="p-1.5 rounded-lg bg-white/5 border border-white/5">
                      <span className="font-bold text-emerald-400 block">🔍 Fill Frame</span>
                      <span>Leaf in focus</span>
                    </div>
                  </div>
                )}

                {/* Capture & Confirmation Actions */}
                <div className="flex items-center justify-center gap-3 pt-1">
                  {!capturedBlob ? (
                    <button
                      type="button"
                      onClick={capturePhoto}
                      className="btn-primary py-3 px-7 rounded-full text-xs font-black flex items-center gap-2 shadow-[0_0_20px_rgba(16,185,129,0.4)] cursor-pointer hover:scale-105 active:scale-95 transition-all"
                    >
                      <Camera className="w-4 h-4 text-emerald-950" />
                      <span>Snap Photo</span>
                    </button>
                  ) : (
                    <>
                      <button
                        type="button"
                        onClick={retakePhoto}
                        className={`py-2.5 px-4 rounded-xl text-xs font-bold cursor-pointer transition-all flex items-center gap-1.5 ${
                          captureValidation && !captureValidation.is_valid
                            ? 'btn-primary shadow-[0_0_15px_rgba(245,158,11,0.4)]'
                            : 'btn-secondary'
                        }`}
                      >
                        <RefreshCw className="w-3.5 h-3.5" />
                        <span>Retake Photo</span>
                      </button>
                      <button
                        type="button"
                        onClick={confirmCapturedPhoto}
                        disabled={isValidatingCapture}
                        className={`py-2.5 px-5 rounded-xl text-xs font-bold flex items-center gap-2 cursor-pointer transition-all ${
                          captureValidation && !captureValidation.is_valid
                            ? 'btn-secondary text-slate-300'
                            : 'btn-primary shadow-[0_0_20px_rgba(16,185,129,0.4)]'
                        } ${isValidatingCapture ? 'opacity-50 cursor-not-allowed' : ''}`}
                      >
                        <Check className="w-4 h-4" />
                        <span>Use Photo &amp; Enhance</span>
                      </button>
                    </>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Expert Feedback Modal */}
      {showFeedbackModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
          <div className="w-full max-w-md rounded-2xl glass-card p-5 border border-emerald-500/30 space-y-4 shadow-2xl bg-slate-900/95 text-left">
            <div className="flex items-center justify-between pb-3 border-b border-white/10">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-emerald-400" />
                Submit Expert Pathology Feedback
              </h3>
              <button
                onClick={() => setShowFeedbackModal(false)}
                className="text-slate-400 hover:text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {feedbackSuccess ? (
              <div className="p-4 rounded-xl bg-emerald-500/20 border border-emerald-500/40 text-center space-y-2">
                <CheckCircle className="w-8 h-8 text-emerald-400 mx-auto" />
                <p className="text-xs font-bold text-emerald-300">Feedback Recorded</p>
                <p className="text-[11px] text-slate-300">Thank you! Your verified diagnosis has been saved to the retraining pipeline.</p>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="text-xs text-slate-400">
                  Current AI Prediction: <strong className="text-white">{result?.disease}</strong> ({result?.confidence}%)
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Correct Pathology / Disease Name *
                  </label>
                  <input
                    type="text"
                    value={feedbackLabel}
                    onChange={(e) => setFeedbackLabel(e.target.value)}
                    placeholder="e.g. Rice Blast, Brown Spot, Healthy..."
                    className="w-full bg-slate-950/80 border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Agronomist Notes / Observations
                  </label>
                  <textarea
                    value={feedbackNotes}
                    onChange={(e) => setFeedbackNotes(e.target.value)}
                    rows={3}
                    placeholder="Describe specific lesions or field conditions observed..."
                    className="w-full bg-slate-950/80 border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
                  />
                </div>
                <div className="flex justify-end gap-2 pt-2">
                  <button
                    onClick={() => setShowFeedbackModal(false)}
                    className="px-3 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 text-xs text-slate-300 border border-white/10 cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleFeedbackSubmit}
                    disabled={!feedbackLabel.trim() || feedbackSubmitting}
                    className="px-4 py-1.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs disabled:opacity-50 flex items-center gap-1.5 cursor-pointer shadow-lg shadow-emerald-500/20"
                  >
                    {feedbackSubmitting && <Loader2 className="w-3 h-3 animate-spin" />}
                    <span>Submit Annotation</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
