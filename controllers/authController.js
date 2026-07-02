const auth = require('../models/authModel');
const Worker = require('../models/addWorker');
const jwt = require('jsonwebtoken');
const bcryptjs = require('bcryptjs');

// Check if user is authorized worker
const checkWorkerAuthorization = async (req, res) => {
  try {
    console.log('🔵 [1] /check-worker endpoint called');
    
    const token = req.header('Authorization')?.replace('Bearer ', '');
    
    if (!token) {
      return res.status(401).json({
        success: false,
        error: "No token provided"
      });
    }

    const decoded = jwt.verify(token, 'mypassword');
    const user = await auth.findById(decoded.userId);
    
    if (!user) {
      return res.status(401).json({
        success: false,
        error: "User not found"
      });
    }

    // Critical role checks
    if (user.role !== 'worker') {
      return res.json({
        success: true,
        isAuthorized: false,
        message: 'User is not a worker'
      });
    }

    if (!user.isVerified) {
      return res.json({
        success: true,
        isAuthorized: false,
        message: 'Worker account not verified'
      });
    }

    if (!user.isActive) {
      return res.json({
        success: true,
        isAuthorized: false,
        message: 'Worker account inactive'
      });
    }

    // Check if worker profile exists and is active - using phone number
    const worker = await Worker.findOne({ 
      phone_number: user.phone,
      status: { $in: ['active', 'busy'] }
    });

    if (worker) {
      return res.json({
        success: true,
        isAuthorized: true,
        worker: {
          id: worker._id,
          name: worker.name,
          phone: worker.phone_number,
          service_type: worker.service_type,
          status: worker.status
        }
      });
    }

    res.json({
      success: true,
      isAuthorized: false,
      message: 'Worker not registered or profile inactive'
    });

  } catch (error) {
    console.error('❌ Worker auth check error:', error.message);
    res.status(500).json({
      success: false,
      error: "Error checking worker authorization: " + error.message
    });
  }
};

// User signup (autonomous registration for users only)
const signup = async (req, res) => {
  let { name, email, username, phone, password, role = 'user', profile = {}, age, gender, dob } = req.body;

  console.log('📝 Signup request received:', { name, email, username, phone, role });

  // For users, phone is required, email and username are optional
  if (!name || !phone || !password) {
    return res.status(400).json({ 
      success: false,
      error: 'Name, phone number and password are required' 
    });
  }

  // BLOCK: Only 'user' and 'admin' roles can sign up autonomously
  // 'worker' role is BLOCKED - must be created by admin
  if (role === 'worker') {
    return res.status(403).json({
      success: false,
      error: 'Worker accounts cannot be created through signup. Please contact an administrator.'
    });
  }

  try {
    // Check if user already exists by phone
    const existingUser = await auth.findOne({ phone });

    if (existingUser) {
      return res.status(400).json({ 
        success: false,
        message: 'Phone number already registered' 
      });
    }

    // If email provided, check for uniqueness
    if (email) {
      const existingEmail = await auth.findOne({ email });
      if (existingEmail) {
        return res.status(400).json({ 
          success: false,
          message: 'Email already registered' 
        });
      }
    }

    // If username provided, check for uniqueness
    if (username) {
      const existingUsername = await auth.findOne({ username });
      if (existingUsername) {
        return res.status(400).json({ 
          success: false,
          message: 'Username already taken' 
        });
      }
    }

    // Hash password
    const salt = await bcryptjs.genSalt(10);
    const hash = await bcryptjs.hash(password, salt);
    
    // Prepare profile data
    let userProfile = {
      age: age || '',
      gender: gender || '',
      dob: dob || '',
      ...profile
    };
    
    const createuser = await auth.create({ 
      name,
      email: email || null,
      username: username || null,
      phone,
      password: hash,
      role: role,
      profile: userProfile,
      isVerified: true,
      isActive: true
    });

    console.log(`✅ ${role} created successfully`);

    res.status(201).json({
      success: true,
      data: {
        id: createuser._id,
        name: createuser.name,
        email: createuser.email,
        username: createuser.username,
        phone: createuser.phone,
        role: createuser.role,
        profile: createuser.profile
      },
      message: role === 'admin' 
        ? "Admin account created successfully" 
        : "User account created successfully"
    });

  } catch (err) {
    console.log("Error occurred: ", err);
    res.status(400).json({
      success: false,
      error: "Failed to create profile: " + err.message
    });
  }
};

// Admin creates worker with phone number as primary login
const createWorkerByAdmin = async (req, res) => {
  try {
    const { 
      name, phone, password, 
      service_type, address, experience_years, 
      skills, hourly_rate, bio, certifications,
      email, username // Optional fields
    } = req.body;

    // Validate required fields - email is NOT required anymore
    if (!name || !phone || !password || !service_type) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: name, phone, password, service_type'
      });
    }

    // Check if admin is creating (verify token)
    const token = req.header('Authorization')?.replace('Bearer ', '');
    if (!token) {
      return res.status(401).json({ success: false, error: 'Unauthorized' });
    }

    const decoded = jwt.verify(token, 'mypassword');
    const admin = await auth.findById(decoded.userId);

    if (!admin || admin.role !== 'admin') {
      return res.status(403).json({ 
        success: false, 
        error: 'Only admins can create worker accounts' 
      });
    }

    // Check if worker already exists by phone
    const existingWorker = await auth.findOne({ phone });
    
    if (existingWorker) {
      return res.status(400).json({
        success: false,
        error: 'Phone number already registered'
      });
    }

    // If email provided, check for uniqueness
    if (email) {
      const existingEmail = await auth.findOne({ email });
      if (existingEmail) {
        return res.status(400).json({
          success: false,
          error: 'Email already registered'
        });
      }
    }

    // If username provided, check for uniqueness
    if (username) {
      const existingUsername = await auth.findOne({ username });
      if (existingUsername) {
        return res.status(400).json({
          success: false,
          error: 'Username already taken'
        });
      }
    }

    // Hash the manually provided password
    const salt = await bcryptjs.genSalt(10);
    const hashedPassword = await bcryptjs.hash(password, salt);

    // Create Auth entry for worker with the provided password
    const authWorker = await auth.create({
      name,
      email: email || null, // Allow null
      username: username || null, // Allow null
      phone, // Phone is required
      password: hashedPassword,
      role: 'worker',
      isVerified: true,
      isActive: true
    });

    // Create Worker profile - email is optional now
    const workerProfile = await Worker.create({
      name,
      email: email || null, // Allow null
      phone_number: phone,
      service_type,
      address: address || {
        street: '',
        city: '',
        state: '',
        pincode: '',
        country: 'India'
      },
      experience_years: experience_years || 0,
      skills: skills || [],
      certifications: certifications || [],
      bio: bio || '',
      hourly_rate: hourly_rate || 0,
      status: 'active',
      created_by: admin._id
    });

    console.log(`✅ Worker created successfully by admin ${admin.email}`);

    // Prepare response - don't send password back
    const responseData = {
      success: true,
      message: 'Worker account created successfully. Worker can login with phone number and password.',
      data: {
        worker: {
          id: workerProfile._id,
          name: workerProfile.name,
          phone: workerProfile.phone_number,
          email: workerProfile.email || 'Not provided',
          service_type: workerProfile.service_type,
          hourly_rate: workerProfile.hourly_rate,
          status: workerProfile.status
        },
        auth: {
          id: authWorker._id,
          phone: authWorker.phone,
          email: authWorker.email || 'Not provided',
          username: authWorker.username || 'Not provided',
        },
        credentials: {
          phone: authWorker.phone,
          password: password // Only send this once for the admin to share with worker
        }
      }
    };

    // If email wasn't provided, add a note
    if (!email) {
      responseData.note = 'Email was not provided. Worker will login using phone number only.';
    }

    res.status(201).json(responseData);

  } catch (err) {
    console.error('Error creating worker:', err);
    res.status(500).json({
      success: false,
      error: err.message
    });
  }
};

// Login function - now supports phone number login for workers
const login = async (req, res) => {
  try {
    const { email, username, phone, password } = req.body;

    // Check if at least one identifier is provided
    if ((!email && !username && !phone) || !password) {
      return res.status(400).json({
        success: false,
        error: 'Phone/email/username and password are required'
      });
    }

    let user = null;

    // Build query based on what's provided
    let query = {};
    if (phone) {
      query.phone = phone;
    } else if (email) {
      query.email = email;
    } else if (username) {
      query.username = username;
    }

    user = await auth.findOne(query);

    if (!user) {
      return res.status(401).json({
        success: false,
        error: 'Invalid credentials'
      });
    }

    // Check if user is active
    if (user.isActive === false) {
      return res.status(401).json({
        success: false,
        error: 'Account is deactivated. Please contact admin.'
      });
    }

    const isMatch = await bcryptjs.compare(password, user.password);
    
    if (!isMatch) {
      return res.status(401).json({
        success: false,
        error: 'Invalid credentials'
      });
    }

    // For workers: Check if they have a worker profile
    if (user.role === 'worker') {
      const workerProfile = await Worker.findOne({ 
        phone_number: user.phone // Use phone number to find worker
      });

      if (!workerProfile) {
        return res.status(403).json({
          success: false,
          error: 'Worker profile not found. Please contact admin.'
        });
      }

      // Check if worker is active
      if (workerProfile.status === 'inactive') {
        return res.status(403).json({
          success: false,
          error: 'Worker account is inactive. Please contact admin.'
        });
      }

      // Check if worker is pending
      if (workerProfile.status === 'pending') {
        return res.status(403).json({
          success: false,
          error: 'Worker account is pending approval. Please contact admin.'
        });
      }
    }

    const token = jwt.sign(
      { 
        userId: user._id, 
        email: user.email,
        username: user.username,
        phone: user.phone,
        role: user.role,
        name: user.name
      }, 
      'mypassword', 
      { expiresIn: '30d' }
    );

    // Set cookie
    res.cookie('token', token, {
      maxAge: 30 * 24 * 60 * 60 * 1000,
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax'
    });

    res.json({
      success: true,
      data: token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email || 'Not provided',
        username: user.username || 'Not provided',
        phone: user.phone,
        role: user.role,
        profile: user.profile
      },
      message: `Welcome back, ${user.name}!`,
    });

  } catch (err) {
    console.log(err);
    res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};

// Get all workers (for users to browse) - only show active workers
const getAllWorkers = async (req, res) => {
  try {
    const { service_type, city, min_rate, max_rate } = req.query;
    
    let query = { status: 'active' };
    
    if (service_type) query.service_type = service_type;
    if (city) query['address.city'] = city;
    if (min_rate || max_rate) {
      query.hourly_rate = {};
      if (min_rate) query.hourly_rate.$gte = parseInt(min_rate);
      if (max_rate) query.hourly_rate.$lte = parseInt(max_rate);
    }
    
    const workers = await Worker.find(query)
      .select('-__v')
      .sort({ rating: -1 });
    
    res.json({
      success: true,
      count: workers.length,
      data: workers
    });
    
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

// Get single worker details
const getWorkerById = async (req, res) => {
  try {
    const worker = await Worker.findById(req.params.id);
    
    if (!worker) {
      return res.status(404).json({
        success: false,
        error: 'Worker not found'
      });
    }
    
    res.json({
      success: true,
      data: worker
    });
    
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

// Update worker profile (worker self-update)
const updateWorkerProfile = async (req, res) => {
  try {
    const token = req.header('Authorization')?.replace('Bearer ', '');
    if (!token) {
      return res.status(401).json({ success: false, error: 'Unauthorized' });
    }
    
    const decoded = jwt.verify(token, 'mypassword');
    const user = await auth.findById(decoded.userId);
    
    if (!user || user.role !== 'worker') {
      return res.status(403).json({ success: false, error: 'Only workers can update their profile' });
    }
    
    const updatedWorker = await Worker.findOneAndUpdate(
      { phone_number: user.phone }, // Use phone number to find worker
      req.body,
      { new: true, runValidators: true }
    );
    
    if (!updatedWorker) {
      return res.status(404).json({ success: false, error: 'Worker profile not found' });
    }
    
    res.json({
      success: true,
      message: 'Profile updated successfully',
      data: updatedWorker
    });
    
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

// Get user profile
const getProfile = async (req, res) => {
  try {
    let token = req.header('Authorization') || req.headers.authorization;
    
    if (token) {
      token = token.replace('Bearer ', '');
    } else {
      token = req.cookies?.token;
    }
    
    if (!token) {
      return res.status(401).json({
        success: false,
        error: 'No token provided'
      });
    }
    
    const decoded = jwt.verify(token, 'mypassword');
    const user = await auth.findById(decoded.userId).select('-password');
    
    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }
    
    return res.json({
      success: true,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        username: user.username,
        phone: user.phone,
        role: user.role,
        profile: user.profile,
        isVerified: user.isVerified
      }
    });
    
  } catch (err) {
    console.log('Server error:', err);
    res.status(500).json({
      success: false,
      error: 'Server error'
    });
  }
};

const logout = async (req, res) => {
  try {
    res.cookie('token', '', {
      maxAge: 0,
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax'
    });

    res.status(200).json({
      success: true,
      message: "Logged out successfully"
    });
    
  } catch (err) {
    console.log(err);
    res.status(500).json({
      success: false,
      message: "Error during logout"
    });
  }
};

const debugToken = async (req, res) => {
  try {
    let token = req.header('Authorization') || req.headers.authorization;
    
    if (token) {
      token = token.replace('Bearer ', '');
    } else {
      token = req.cookies?.token;
    }
    
    if (!token) {
      return res.json({
        success: false,
        error: 'No token provided'
      });
    }
    
    token = token.trim().replace(/^["']|["']$/g, '');
    
    const result = {
      success: true,
      tokenInfo: {
        length: token.length,
        first50Chars: token.substring(0, 50),
        isJWTFormat: token.split('.').length === 3
      }
    };
    
    const parts = token.split('.');
    if (parts.length === 3) {
      try {
        const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString());
        result.tokenInfo.decodedPayload = payload;
        
        try {
          const verified = jwt.verify(token, 'mypassword');
          result.tokenInfo.verified = true;
          result.tokenInfo.userId = verified.userId;
        } catch (verifyError) {
          result.tokenInfo.verified = false;
          result.tokenInfo.verificationError = verifyError.message;
        }
      } catch (decodeError) {
        result.tokenInfo.decodeError = decodeError.message;
      }
    }
    
    res.json(result);
    
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

// ADMIN: Get all workers (including pending/inactive)
const getAllWorkersForAdmin = async (req, res) => {
  try {
    // Verify admin token
    const token = req.header('Authorization')?.replace('Bearer ', '');
    if (!token) {
      return res.status(401).json({ success: false, error: 'Unauthorized' });
    }

    const decoded = jwt.verify(token, 'mypassword');
    const admin = await auth.findById(decoded.userId);

    if (!admin || admin.role !== 'admin') {
      return res.status(403).json({ 
        success: false, 
        error: 'Only admins can access this endpoint' 
      });
    }

    // Get all workers with their auth info
    const workers = await Worker.find({})
      .sort({ createdAt: -1 })
      .select('-__v');

    // Get auth info for each worker
    const workersWithAuth = await Promise.all(workers.map(async (worker) => {
      const authUser = await auth.findOne({ phone: worker.phone_number });
      return {
        ...worker.toObject(),
        username: authUser?.username || '',
        isActive: authUser?.isActive || false,
        isVerified: authUser?.isVerified || false,
      };
    }));

    res.json({
      success: true,
      count: workersWithAuth.length,
      data: workersWithAuth
    });

  } catch (error) {
    console.error('Error fetching workers for admin:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

// ADMIN: Update worker status
const updateWorkerStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    // Verify admin token
    const token = req.header('Authorization')?.replace('Bearer ', '');
    if (!token) {
      return res.status(401).json({ success: false, error: 'Unauthorized' });
    }

    const decoded = jwt.verify(token, 'mypassword');
    const admin = await auth.findById(decoded.userId);

    if (!admin || admin.role !== 'admin') {
      return res.status(403).json({ 
        success: false, 
        error: 'Only admins can update worker status' 
      });
    }

    // Validate status
    const validStatuses = ['active', 'inactive', 'pending', 'busy'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid status. Must be one of: active, inactive, pending, busy'
      });
    }

    const worker = await Worker.findByIdAndUpdate(
      id,
      { status },
      { new: true, runValidators: true }
    );

    if (!worker) {
      return res.status(404).json({
        success: false,
        error: 'Worker not found'
      });
    }

    res.json({
      success: true,
      message: `Worker status updated to ${status}`,
      data: worker
    });

  } catch (error) {
    console.error('Error updating worker status:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

// ADMIN: Delete worker
const deleteWorker = async (req, res) => {
  try {
    const { id } = req.params;

    // Verify admin token
    const token = req.header('Authorization')?.replace('Bearer ', '');
    if (!token) {
      return res.status(401).json({ success: false, error: 'Unauthorized' });
    }

    const decoded = jwt.verify(token, 'mypassword');
    const admin = await auth.findById(decoded.userId);

    if (!admin || admin.role !== 'admin') {
      return res.status(403).json({ 
        success: false, 
        error: 'Only admins can delete workers' 
      });
    }

    // Find worker to get phone number
    const worker = await Worker.findById(id);
    if (!worker) {
      return res.status(404).json({
        success: false,
        error: 'Worker not found'
      });
    }

    // Delete worker profile
    await Worker.findByIdAndDelete(id);

    // Delete auth entry using phone number
    await auth.findOneAndDelete({ phone: worker.phone_number });

    res.json({
      success: true,
      message: 'Worker deleted successfully'
    });

  } catch (error) {
    console.error('Error deleting worker:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

module.exports = {
  signup,
  login,
  logout,
  getProfile,
  debugToken,
  checkWorkerAuthorization,
  createWorkerByAdmin,
  getAllWorkers,
  getWorkerById,
  updateWorkerProfile,
  getAllWorkersForAdmin,
  updateWorkerStatus,
  deleteWorker
};