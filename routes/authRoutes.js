import express from 'express';
import { 
  register, 
  login, 
  sendRegisterOtp, 
  googleLogin, 
  forgotPassword, 
  resetPassword,
  getProfile,
  updateProfile
} from '../controllers/authController.js';
import { protect } from '../middleware/auth.js';

const router = express.Router();

// Route: POST /api/auth/register/send-otp
router.post('/register/send-otp', sendRegisterOtp);

// Route: POST /api/auth/register
router.post('/register', register);

// Route: POST /api/auth/login
router.post('/login', login);

// Route: POST /api/auth/google
router.post('/google', googleLogin);

// Route: POST /api/auth/forgot-password
router.post('/forgot-password', forgotPassword);

// Route: POST /api/auth/reset-password
router.post('/reset-password', resetPassword);

// Route: GET & PUT /api/auth/profile (Protected)
router.get('/profile', protect, getProfile);
router.put('/profile', protect, updateProfile);

export default router;
