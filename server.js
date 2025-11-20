const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const bodyParser = require('body-parser');
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = 3000;
const DB_PATH = './hotel.db';

// Middleware
app.use(cors());
app.use(bodyParser.json({ limit: '50mb' })); // Support Base64 images
app.use(express.static('public')); // Serve frontend files

// Database Setup
const db = new sqlite3.Database(DB_PATH, (err) => {
    if (err) console.error('DB Error:', err.message);
    else console.log('Connected to SQLite database.');
});

// Initialize Tables & Seed Data
db.serialize(() => {
    // Users
    db.run(`CREATE TABLE IF NOT EXISTS users (id TEXT PRIMARY KEY, username TEXT, password TEXT, name TEXT, role TEXT)`);
    
    // Rooms
    db.run(`CREATE TABLE IF NOT EXISTS rooms (id TEXT PRIMARY KEY, name TEXT, price INTEGER, status TEXT, image TEXT, amenities TEXT)`);
    
    // Bookings
    db.run(`CREATE TABLE IF NOT EXISTS bookings (id TEXT PRIMARY KEY, roomId TEXT, roomName TEXT, checkin TEXT, checkout TEXT, guest TEXT, phone TEXT, total REAL, status TEXT, slip TEXT, created TEXT)`);
    
    // Payments
    db.run(`CREATE TABLE IF NOT EXISTS payments (id TEXT PRIMARY KEY, bookingId TEXT, amount REAL, date TEXT, method TEXT)`);
    
    // Notifications
    db.run(`CREATE TABLE IF NOT EXISTS notifications (id TEXT PRIMARY KEY, msg TEXT, date TEXT, read INTEGER)`);
    
    // Settings (Store as JSON string)
    db.run(`CREATE TABLE IF NOT EXISTS settings (id INTEGER PRIMARY KEY, data TEXT)`);

    // --- SEED INITIAL DATA ---
    db.get("SELECT count(*) as count FROM users", (err, row) => {
        if (row.count === 0) {
            console.log("Seeding Users...");
            db.run(`INSERT INTO users VALUES ('U1', 'admin', '1234', 'General Manager', 'admin')`);
            db.run(`INSERT INTO users VALUES ('U2', 'user', '1234', 'Receptionist', 'staff')`);
        }
    });

    db.get("SELECT count(*) as count FROM rooms", (err, row) => {
        if (row.count === 0) {
            console.log("Seeding Rooms...");
            const rooms = [
                ['R101', 'Deluxe Garden', 2500, 'available', 'https://images.unsplash.com/photo-1611892440504-42a792e24d32?w=500', 'WiFi,King Bed'],
                ['R102', 'Pool Villa', 5900, 'available', 'https://images.unsplash.com/photo-1582719478250-c89cae4dc85b?w=500', 'Pool,Jacuzzi'],
                ['R103', 'Ocean Suite', 8500, 'available', 'https://images.unsplash.com/photo-1566665797739-1674de7a421a?w=500', 'Sea View,Butler']
            ];
            const stmt = db.prepare("INSERT INTO rooms VALUES (?, ?, ?, ?, ?, ?)");
            rooms.forEach(r => stmt.run(r));
            stmt.finalize();
        }
    });

    db.get("SELECT count(*) as count FROM settings", (err, row) => {
        if (row.count === 0) {
            console.log("Seeding Settings...");
            const defaultSettings = {
                brand: { name_th: 'SERENITY', name_en: 'Experience Luxury', slogan: 'พักผ่อนในบรรยากาศสุดพิเศษ', address: '123 Beach Road, Phuket', phone: '02-123-4567', email: 'info@serenity.com', logo: '', lat: '', lng: '', line_oa: '', checkin: '14:00', checkout: '12:00', policy: 'No refund', currency: 'THB', lang: 'TH' },
                social: { facebook: '', line: '', instagram: '' },
                theme: { primary: '#c5a028', secondary: '#1a202c', font: 'Prompt', size: '16' },
                seo: { title: 'Serenity Hotel', desc: 'Luxury Hotel', keywords: 'hotel, travel' },
                payment_methods: [{ id: 'bank', name: 'โอนเงิน', enabled: true, details: 'กสิกรไทย 123-4-56789-0' }, { id: 'card', name: 'บัตรเครดิต', enabled: true, details: 'Stripe/Omise' }]
            };
            db.run("INSERT INTO settings (id, data) VALUES (1, ?)", [JSON.stringify(defaultSettings)]);
        }
    });
});

// --- API ENDPOINTS ---

// Generic GET
app.get('/api/:table', (req, res) => {
    const table = req.params.table;
    if (table === 'settings') {
        db.get("SELECT data FROM settings WHERE id = 1", (err, row) => {
            if (err) return res.status(500).json({ error: err.message });
            res.json(row ? JSON.parse(row.data) : {});
        });
    } else {
        db.all(`SELECT * FROM ${table}`, (err, rows) => {
            if (err) return res.status(500).json({ error: err.message });
            res.json(rows);
        });
    }
});

// Generic POST (Add)
app.post('/api/:table', (req, res) => {
    const table = req.params.table;
    const data = req.body;

    if (table === 'settings') {
        db.run("UPDATE settings SET data = ? WHERE id = 1", [JSON.stringify(data)], function(err) {
            if (err) return res.status(500).json({ error: err.message });
            res.json({ success: true });
        });
    } else {
        const keys = Object.keys(data);
        const values = Object.values(data);
        const placeholders = keys.map(() => '?').join(',');
        const sql = `INSERT INTO ${table} (${keys.join(',')}) VALUES (${placeholders})`;
        
        db.run(sql, values, function(err) {
            if (err) return res.status(500).json({ error: err.message });
            res.json({ id: this.lastID, ...data });
        });
    }
});

// Generic PUT (Update)
app.put('/api/:table/:id', (req, res) => {
    const { table, id } = req.params;
    const data = req.body;
    const updates = Object.keys(data).map(key => `${key} = ?`).join(',');
    const values = [...Object.values(data), id];

    db.run(`UPDATE ${table} SET ${updates} WHERE id = ?`, values, function(err) {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ success: true });
    });
});

// Generic DELETE
app.delete('/api/:table/:id', (req, res) => {
    const { table, id } = req.params;
    db.run(`DELETE FROM ${table} WHERE id = ?`, id, function(err) {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ success: true });
    });
});

// Start Server
app.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}`);
});