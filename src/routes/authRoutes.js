import { Router } from 'express';
import AuthController from '../Controller/AuthController.js';
import { authMiddleware } from '../middleware/auth.js';

const router = Router();

router.post('/register', AuthController.register);
router.post('/login', AuthController.login);
router.get('/me', authMiddleware, AuthController.getCurrentUser);
router.post('/change-password', authMiddleware, AuthController.changePassword);

export default router;