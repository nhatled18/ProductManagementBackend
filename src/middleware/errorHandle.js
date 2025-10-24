export function errorHandler(err, req, res, next) {
  console.error('Error:', err);

  // Prisma errors
  if (err.code === 'P2002') {
    return res.status(400).json({ 
      error: 'Dữ liệu đã tồn tại trong hệ thống' 
    });
  }

  if (err.code === 'P2025') {
    return res.status(404).json({ 
      error: 'Không tìm thấy dữ liệu' 
    });
  }

  // JWT errors
  if (err.name === 'JsonWebTokenError') {
    return res.status(401).json({ error: 'Token không hợp lệ' });
  }

  if (err.name === 'TokenExpiredError') {
    return res.status(401).json({ error: 'Token đã hết hạn' });
  }

  // Validation errors
  if (err.name === 'ValidationError') {
    return res.status(400).json({ error: err.message });
  }

  // Default error
  res.status(err.status || 500).json({
    error: err.message || 'Lỗi server',
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
  });
}

// 404 handler
export function notFound(req, res, next) {
  res.status(404).json({ 
    error: `Không tìm thấy route: ${req.originalUrl}` 
  });
}
