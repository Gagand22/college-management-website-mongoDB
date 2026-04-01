const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(__dirname));
app.use(express.static(path.join(__dirname, 'frontend')));

// --- SMART ROUTE TO FIND INDEX.HTML ---
app.get('/', (req, res) => {
    const rootPath = path.join(__dirname, 'index.html');
    const frontendPath = path.join(__dirname, 'frontend', 'index.html');
    if (fs.existsSync(rootPath)) res.sendFile(rootPath);
    else if (fs.existsSync(frontendPath)) res.sendFile(frontendPath);
    else res.status(404).send("index.html not found");
});

// --- 1. DATABASE CONNECTION (MONGODB) ---
const MONGO_URI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/uniportal_db';

mongoose.connect(MONGO_URI, {
    serverSelectionTimeoutMS: 5000, // Keep trying to connect for 5 seconds
    socketTimeoutMS: 45000,         // Close sockets after 45s of inactivity
})
    .then(() => console.log('✅ Connected to MongoDB'))
    .catch(err => console.error('❌ MongoDB Connection Error:', err));

// --- 2. SCHEMAS ---
const userSchema = new mongoose.Schema({
    username: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    role: { type: String, required: true },
    name: { type: String, required: true },
    course: String,
    rollNumber: String,
    email: String,
    mobile: String,
    semester: Number,
    subjects: [String]
});

const attendanceSchema = new mongoose.Schema({
    studentId: mongoose.Schema.Types.ObjectId,
    date: String,
    subject: String,
    period: Number,
    status: String
});

const User = mongoose.model('User', userSchema);
const Attendance = mongoose.model('Attendance', attendanceSchema);

// --- 3. SEED DATA (Safe for Vercel) ---
async function seedDB() {
    const count = await User.countDocuments();
    if (count === 0) {
        console.log("🌱 Seeding Database...");
        await User.create([
            { username: "admin", password: "admin123", role: "admin", name: "System Admin" },
            { username: "teacher1", password: "123", role: "teacher", name: "Mr. Anil Kumar", subjects: ["Java Programming", "Data Structures"] },
            { username: "teacher2", password: "123", role: "teacher", name: "Ms. Sunita Singh", subjects: ["Business Studies", "Marketing Mgmt"] },
            { username: "rahul", password: "123", role: "student", name: "Rahul Sharma", course: "BCA", rollNumber: "BCA-01", semester: 3 },
            { username: "priya", password: "123", role: "student", name: "Priya Singh", course: "BCA", rollNumber: "BCA-02", semester: 3 },
            { username: "amit", password: "123", role: "student", name: "Amit Verma", course: "BBA", rollNumber: "BBA-01", semester: 3 }
        ]);
        console.log("✅ Seeding Complete.");
    }
}
seedDB();

// --- 4. HELPERS ---
// --- 3. HELPERS ---

// Helper to convert String ID to ObjectId
function toObjectId(id) {
    return new mongoose.Types.ObjectId(id);
}

async function calculateAttendance(studentId) {
    // Safety check: If ID is invalid, return zeros
    if (!studentId) {
        return { semesterPercentage: 0, total: 0, present: 0, monthlyPercentage: 0, monthlyTotal: 0, monthlyPresent: 0 };
    }

    // Convert string ID to ObjectId
    const records = await Attendance.find({ studentId: toObjectId(studentId) });
    
    const totalClasses = records.length;
    const presentCount = records.filter(r => r.status === 'present').length;
    const semesterPercentage = totalClasses === 0 ? 0 : ((presentCount / totalClasses) * 100).toFixed(1);

    const currentMonth = new Date().getMonth();
    const monthlyRecords = records.filter(r => new Date(r.date).getMonth() === currentMonth);
    const monthlyTotal = monthlyRecords.length;
    const monthlyPresent = monthlyRecords.filter(r => r.status === 'present').length;
    const monthlyPercentage = monthlyTotal === 0 ? 0 : ((monthlyPresent / monthlyTotal) * 100).toFixed(1);

    return { semesterPercentage, total: totalClasses, present: presentCount, monthlyPercentage, monthlyTotal, monthlyPresent };
}

async function calculateSubjectAttendance(studentId) {
    // FIX: Convert the incoming string ID to ObjectId before searching
    const records = await Attendance.find({ studentId: toObjectId(studentId) });
    
    let subjectStats = {};
    records.forEach(record => {
        if (!subjectStats[record.subject]) subjectStats[record.subject] = { total: 0, present: 0 };
        subjectStats[record.subject].total++;
        if (record.status === 'present') subjectStats[record.subject].present++;
    });
    let result = [];
    for (let sub in subjectStats) {
        let stats = subjectStats[sub];
        let percent = ((stats.present / stats.total) * 100).toFixed(1);
        result.push({ subject: sub, present: stats.present, total: stats.total, percentage: percent, isShortage: percent < 75 });
    }
    return result;
}

async function calculateAttendance(studentId) {
    const records = await Attendance.find({ studentId: studentId });
    const totalClasses = records.length;
    const presentCount = records.filter(r => r.status === 'present').length;
    const semesterPercentage = totalClasses === 0 ? 0 : ((presentCount / totalClasses) * 100).toFixed(1);

    const currentMonth = new Date().getMonth();
    const monthlyRecords = records.filter(r => new Date(r.date).getMonth() === currentMonth);
    const monthlyTotal = monthlyRecords.length;
    const monthlyPresent = monthlyRecords.filter(r => r.status === 'present').length;
    const monthlyPercentage = monthlyTotal === 0 ? 0 : ((monthlyPresent / monthlyTotal) * 100).toFixed(1);

    return { semesterPercentage, total: totalClasses, present: presentCount, monthlyPercentage, monthlyTotal, monthlyPresent };
}

async function calculateSubjectAttendance(studentId) {
    const records = await Attendance.find({ studentId: studentId });
    let subjectStats = {};
    records.forEach(record => {
        if (!subjectStats[record.subject]) subjectStats[record.subject] = { total: 0, present: 0 };
        subjectStats[record.subject].total++;
        if (record.status === 'present') subjectStats[record.subject].present++;
    });
    let result = [];
    for (let sub in subjectStats) {
        let stats = subjectStats[sub];
        let percent = ((stats.present / stats.total) * 100).toFixed(1);
        result.push({ subject: sub, present: stats.present, total: stats.total, percentage: percent, isShortage: percent < 75 });
    }
    return result;
}

// --- 5. ROUTES ---
app.post('/api/login', async (req, res) => {
    const { username, password } = req.body;
    const user = await User.findOne({ username: username, password: password });
    if (user) {
        const userObj = user.toObject();
        delete userObj.password;
        
        // --- FIX: Map MongoDB '_id' to 'id' so the frontend understands it ---
        userObj.id = userObj._id.toString();
        // ---------------------------------------------------------------------

        res.json({ success: true, user: userObj });
    } else {
        res.status(401).json({ success: false, message: "Invalid Credentials" });
    }
});

app.get('/api/student/subjects/:course', (req, res) => res.json(subjects[req.params.course] || []));
app.get('/api/student/timetable/:course', (req, res) => res.json(generateTimetable(req.params.course)));

app.get('/api/student/attendance/:id', async (req, res) => {
    try {
        const overall = await calculateAttendance(req.params.id);
        const subjectWise = await calculateSubjectAttendance(req.params.id);
        
        // FIX: Convert ID for history too
        const history = await Attendance.find({ studentId: toObjectId(req.params.id) }).sort({ date: -1 });
        
        res.json({ overall, subjects: subjectWise, history });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/teacher/today', (req, res) => {
    const { subjectsAssigned } = req.body;
    const dayNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
    const today = dayNames[new Date().getDay()];
    let todayClasses = [];
    Object.keys(subjects).forEach(course => {
        const schedule = generateTimetable(course);
        (schedule[today] || []).forEach(slot => {
            if (subjectsAssigned.includes(slot.subject)) todayClasses.push({ ...slot, course });
        });
    });
    res.json({ day: today, classes: todayClasses });
});

app.get('/api/admin/students/:course', async (req, res) => {
    const students = await User.find({ course: req.params.course, role: 'student' }).sort({ name: 1 });
    const studentsWithStats = await Promise.all(students.map(async (s) => {
        const stats = await calculateAttendance(s._id);
        return { ...s.toObject(), stats };
    }));
    res.json(studentsWithStats);
});

app.post('/api/admin/attendance', async (req, res) => {
    const { date, subject, courseId, period, absentRollNumbers } = req.body;
    const students = await User.find({ course: courseId, role: 'student' }).sort({ _id: 1 });
    const absentIndices = absentRollNumbers.map(r => parseInt(r.trim()).filter(n => !isNaN(n)));

    const operations = students.map((student, index) => {
        const isAbsent = absentIndices.includes(index + 1);
        const status = isAbsent ? 'absent' : 'present';
        return Attendance.findOneAndUpdate(
            { studentId: student._id, date: date, subject: subject, period: period },
            { status: status },
            { upsert: true, new: true }
        );
    });

    await Promise.all(operations);
    res.json({ success: true, message: "Attendance Updated Successfully" });
});

app.get('/api/admin/shortage/:course', async (req, res) => {
    const students = await User.find({ course: req.params.course, role: 'student' });
    const shortageList = [];
    for (const s of students) {
        const stats = await calculateAttendance(s._id);
        if (stats.total > 0 && stats.semesterPercentage < 75) {
            shortageList.push({ ...s.toObject(), stats });
        }
    }
    res.json(shortageList);
});

app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
