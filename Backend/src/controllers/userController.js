const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const SavedJob = require('../models/SavedJob'); // New: SavedJob model

// User Registration
const createUser = async (req, res) => {
    try {
        const { username, email, password, experienceLevel } = req.body;

        // Check if all required fields are provided
        if (!username || !email || !password || !experienceLevel) {
            return res.status(400).json({
                success: false,
                message: "Please provide all required fields: username, email, password, experienceLevel"
            });
        }

        // Hash the password
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);

        // Attempt to create a new user with the hashed password
        const newUser = await User.create({ username, email, password: hashedPassword, experienceLevel });

        res.status(201).json({
            success: true,
            message: "User created successfully",
            data: newUser,
        });
    } catch (error) {
        // Handle duplicate key error
        if (error.code === 11000) {
            const duplicateKey = Object.keys(error.keyValue)[0]; // e.g., 'username' or 'email'
            return res.status(400).json({
                success: false,
                message: `Duplicate value error: The ${duplicateKey} '${error.keyValue[duplicateKey]}' is already taken.`,
            });
        }

        // Handle other errors
        if (error.name === "ValidationError") {
            return res.status(400).json({
                success: false,
                message: "Validation error",
                error: error.message,
            });
        }

        console.error("Error in createUser:", error.message);
        res.status(500).json({
            success: false,
            message: "Error creating user",
            error: error.message,
        });
    }
};

// User Login
const loginUser = async (req, res) => {
    try {
        const { email, password } = req.body;

        // Check if email and password are provided
        if (!email || !password) {
            return res.status(400).json({
                success: false,
                message: "Please provide both email and password"
            });
        }

        // Find the user by email
        const user = await User.findOne({ email });
        if (!user) {
            return res.status(404).json({
                success: false,
                message: "User not found"
            });
        }

        // Compare the provided password with the hashed password in the database
        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            return res.status(401).json({
                success: false,
                message: "Invalid credentials"
            });
        }

        // Generate a JWT token
        const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: '1h' });

        // If everything is correct, send a success response with the token
        res.status(200).json({
            success: true,
            message: "Login successful",
            token: token,
            data: {
                id: user._id,
                username: user.username,
                email: user.email,
                experienceLevel: user.experienceLevel,
            },
        });

    } catch (error) {
        console.error("Error in loginUser:", error.message);
        res.status(500).json({
            success: false,
            message: "Error logging in",
            error: error.message,
        });
    }
};

// Get User Profile by Email
const getUserProfile = async (req, res) => {
    try {
        const { email } = req.params; // Fetch email from request params

        if (!email) {
            return res.status(400).json({ success: false, message: "Email is required" });
        }

        const user = await User.findOne({ email }).select("-password"); // Exclude password

        if (!user) {
            return res.status(404).json({ success: false, message: "User not found" });
        }

        res.status(200).json({ success: true, data: user });
    } catch (error) {
        console.error("Error in getUserProfile:", error.message);
        res.status(500).json({ success: false, message: "Internal Server Error" });
    }
};

// -----------------------
// Saved Jobs Endpoints
// -----------------------

// Get all saved jobs for a given email
const getSavedJobs = async (req, res) => {
    try {
        const { email } = req.params;
        if (!email) {
            return res.status(400).json({ success: false, message: "Email is required" });
        }
        const savedJobs = await SavedJob.find({ email });
        res.status(200).json({ success: true, data: savedJobs });
    } catch (error) {
        console.error("Error in getSavedJobs:", error.message);
        res.status(500).json({ success: false, message: "Error retrieving saved jobs", error: error.message });
    }
};

// Save a job for a given email
const saveJob = async (req, res) => {
    try {
        const { email } = req.params;
        const { job } = req.body; // Expecting the full job object
        if (!job || !job.id) {
            return res.status(400).json({ success: false, message: "Job data is missing or incomplete." });
        }
        // Check if the job is already saved for this user
        const existing = await SavedJob.findOne({ email, "job.id": job.id });
        if (existing) {
            return res.status(400).json({ success: false, message: "Job already saved." });
        }
        const newSavedJob = await SavedJob.create({ email, job });
        res.status(201).json({ success: true, message: "Job saved successfully", data: newSavedJob });
    } catch (error) {
        console.error("Error in saveJob:", error.message);
        res.status(500).json({ success: false, message: "Error saving job", error: error.message });
    }
};

// Unsave (delete) a job for a given email by job id
const unsaveJob = async (req, res) => {
    try {
        const { email, jobId } = req.params;
        if (!email || !jobId) {
            return res.status(400).json({ success: false, message: "Email and jobId are required." });
        }
        const deletedJob = await SavedJob.findOneAndDelete({ email, "job.id": jobId });
        if (!deletedJob) {
            return res.status(404).json({ success: false, message: "Job not found." });
        }
        res.status(200).json({ success: true, message: "Job unsaved successfully." });
    } catch (error) {
        console.error("Error in unsaveJob:", error.message);
        res.status(500).json({ success: false, message: "Error unsaving job", error: error.message });
    }
};

module.exports = {
    createUser,
    loginUser,
    getUserProfile,
    getSavedJobs, 
    saveJob,
    unsaveJob
};
