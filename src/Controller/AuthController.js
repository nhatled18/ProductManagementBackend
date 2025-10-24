import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

const prisma = new PrismaClient();

class AuthController {
  // POST /api/auth/register
  async register(req, res) {
    try {
      const { username, email, password, fullName } = req.body;

      // Validation cơ bản
      if (!username || !email || !password) {
        return res.status(400).json({ 
          message: 'Vui lòng điền đầy đủ thông tin',
          error: 'Vui lòng điền đầy đủ thông tin' 
        });
      }

      if (!/^[a-zA-Z0-9_]{3,30}$/.test(username)) {
        return res.status(400).json({ 
          message: 'Username phải từ 3-30 ký tự và chỉ chứa chữ cái, số, dấu gạch dưới',
          error: 'Username phải từ 3-30 ký tự và chỉ chứa chữ cái, số, dấu gạch dưới'
        });
      }

      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        return res.status(400).json({ 
          message: 'Email không hợp lệ',
          error: 'Email không hợp lệ' 
        });
      }

      if (password.length < 6) {
        return res.status(400).json({ 
          message: 'Password phải có ít nhất 6 ký tự',
          error: 'Password phải có ít nhất 6 ký tự' 
        });
      }

      // Kiểm tra user đã tồn tại
      const existingUser = await prisma.user.findFirst({
        where: { OR: [{ username }, { email: email.toLowerCase() }] }
      });

      if (existingUser) {
        const errorMsg = existingUser.username === username 
          ? 'Tên đăng nhập đã tồn tại' 
          : 'Email đã được đăng ký';
        return res.status(400).json({ 
          message: errorMsg,
          error: errorMsg 
        });
      }

      // Hash password
      const hashedPassword = await bcrypt.hash(password, 10);

      // Tạo user mới
      const user = await prisma.user.create({
        data: {
          username,
          email: email.toLowerCase(),
          password: hashedPassword,
          fullName: fullName || username, // Sử dụng fullName nếu có
          role: 'user'
        },
        select: {
          id: true,
          username: true,
          email: true,
          fullName: true,
          role: true,
          createdAt: true
        }
      });

      if (!process.env.JWT_SECRET) {
        console.error('JWT_SECRET is not defined');
        return res.status(500).json({ 
          message: 'Lỗi cấu hình server',
          error: 'Lỗi cấu hình server' 
        });
      }

      const token = jwt.sign(
        { id: user.id, username: user.username, role: user.role },
        process.env.JWT_SECRET,
        { expiresIn: '7d' }
      );

      res.status(201).json({
        message: 'Đăng ký thành công',
        user,
        token
      });
    } catch (error) {
      console.error('Register error:', error);
      res.status(500).json({ 
        message: 'Lỗi khi đăng ký tài khoản',
        error: 'Lỗi khi đăng ký tài khoản' 
      });
    }
  }

  // POST /api/auth/login
  async login(req, res) {
    try {
      const { username, password } = req.body;
      
      if (!username || !password) {
        return res.status(400).json({ 
          message: 'Vui lòng nhập username và password',
          error: 'Vui lòng nhập username và password' 
        });
      }

      const user = await prisma.user.findFirst({
        where: {
          OR: [
            { username },
            { email: username.toLowerCase() }
          ]
        }
      });

      if (!user) {
        return res.status(401).json({ 
          message: 'Tên đăng nhập hoặc mật khẩu không đúng',
          error: 'Tên đăng nhập hoặc mật khẩu không đúng' 
        });
      }

      const validPassword = await bcrypt.compare(password, user.password);
      if (!validPassword) {
        return res.status(401).json({ 
          message: 'Tên đăng nhập hoặc mật khẩu không đúng',
          error: 'Tên đăng nhập hoặc mật khẩu không đúng' 
        });
      }

      if (!process.env.JWT_SECRET) {
        console.error('JWT_SECRET is not defined');
        return res.status(500).json({ 
          message: 'Lỗi cấu hình server',
          error: 'Lỗi cấu hình server' 
        });
      }

      const token = jwt.sign(
        { id: user.id, username: user.username, role: user.role },
        process.env.JWT_SECRET,
        { expiresIn: '7d' }
      );

      res.json({
        message: 'Đăng nhập thành công',
        user: {
          id: user.id,
          username: user.username,
          email: user.email,
          fullName: user.fullName,
          role: user.role
        },
        token
      });
    } catch (error) {
      console.error('Login error:', error);
      res.status(500).json({ 
        message: 'Lỗi khi đăng nhập',
        error: 'Lỗi khi đăng nhập' 
      });
    }
  }

  // GET /api/auth/me
  async getCurrentUser(req, res) {
    try {
      if (!req.user || !req.user.id) {
        return res.status(401).json({ 
          message: 'Unauthorized',
          error: 'Unauthorized' 
        });
      }

      const user = await prisma.user.findUnique({
        where: { id: req.user.id },
        select: {
          id: true,
          username: true,
          email: true,
          fullName: true,
          role: true,
          createdAt: true,
          updatedAt: true
        }
      });

      if (!user) {
        return res.status(404).json({ 
          message: 'Không tìm thấy user',
          error: 'Không tìm thấy user' 
        });
      }

      res.json(user);
    } catch (error) {
      console.error('Get current user error:', error);
      res.status(500).json({ 
        message: 'Lỗi khi lấy thông tin user',
        error: 'Lỗi khi lấy thông tin user' 
      });
    }
  }

  // POST /api/auth/change-password
  async changePassword(req, res) {
    try {
      const { currentPassword, newPassword } = req.body;

      if (!currentPassword || !newPassword) {
        return res.status(400).json({ 
          message: 'Vui lòng nhập đầy đủ thông tin',
          error: 'Vui lòng nhập đầy đủ thông tin' 
        });
      }

      if (newPassword.length < 6) {
        return res.status(400).json({ 
          message: 'Password mới phải có ít nhất 6 ký tự',
          error: 'Password mới phải có ít nhất 6 ký tự' 
        });
      }

      const user = await prisma.user.findUnique({ 
        where: { id: req.user.id } 
      });
      
      if (!user) {
        return res.status(404).json({ 
          message: 'Không tìm thấy user',
          error: 'Không tìm thấy user' 
        });
      }

      const validPassword = await bcrypt.compare(currentPassword, user.password);
      if (!validPassword) {
        return res.status(401).json({ 
          message: 'Password hiện tại không đúng',
          error: 'Password hiện tại không đúng' 
        });
      }

      const hashedPassword = await bcrypt.hash(newPassword, 10);

      await prisma.user.update({
        where: { id: req.user.id },
        data: { password: hashedPassword }
      });

      res.json({ message: 'Đổi password thành công' });
    } catch (error) {
      console.error('Change password error:', error);
      res.status(500).json({ 
        message: 'Lỗi khi đổi password',
        error: 'Lỗi khi đổi password' 
      });
    }
  }

  // POST /api/auth/logout
  async logout(req, res) {
    try {
      // Trong JWT, logout chỉ cần client xóa token
      // Nếu muốn blacklist token, cần implement thêm
      res.json({ message: 'Đăng xuất thành công' });
    } catch (error) {
      console.error('Logout error:', error);
      res.status(500).json({ 
        message: 'Lỗi khi đăng xuất',
        error: 'Lỗi khi đăng xuất' 
      });
    }
  }
}

export default new AuthController();