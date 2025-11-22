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
    
    // Rooms (Image column now stores JSON string of array)
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
        if (row && row.count === 0) {
            console.log("Seeding Users...");
            db.run(`INSERT INTO users VALUES ('U1', 'admin', '1234', 'General Manager', 'admin')`);
            db.run(`INSERT INTO users VALUES ('U2', 'user', '1234', 'Receptionist', 'staff')`);
        }
    });

    db.get("SELECT count(*) as count FROM rooms", (err, row) => {
        if (row && row.count === 0) {
            console.log("Seeding Rooms with Multiple Images...");
            const stmt = db.prepare("INSERT INTO rooms VALUES (?, ?, ?, ?, ?, ?)");
            
            // Helper to stringify image array
            const imgs = (arr) => JSON.stringify(arr);

            const originalRooms = [
                ['R101', 'Grand Deluxe Garden', 2500, 'available', imgs(['https://images.unsplash.com/photo-1611892440504-42a792e24d32?w=800', 'https://images.unsplash.com/photo-1584622650111-993a426fbf0a?w=800', 'https://images.unsplash.com/photo-1590490360182-c33d57733427?w=800']), 'WiFi,King Bed,Balcony,Garden View'],
                ['R102', 'Private Pool Villa', 5900, 'available', imgs(['https://images.unsplash.com/photo-1582719478250-c89cae4dc85b?w=800', 'https://images.unsplash.com/photo-1566665797739-1674de7a421a?w=800', 'https://images.unsplash.com/photo-1576675784201-0e142b423633?w=800']), 'Private Pool,Jacuzzi,Breakfast,Butler'],
                ['R103', 'Royal Ocean Suite', 8500, 'available', imgs(['https://images.unsplash.com/photo-1566665797739-1674de7a421a?w=800', 'https://images.unsplash.com/photo-1520250497591-112f2f40a3f4?w=800', 'https://images.unsplash.com/photo-1582719508461-905c673771fd?w=800']), 'Sea View,Living Room,Lounge Access,Bathtub']
            ];
            originalRooms.forEach(r => stmt.run(r));

            // Standard Rooms
            for (let i = 1; i <= 5; i++) {
                const num = i.toString().padStart(2, '0');
                stmt.run(`R2${num}`, `Standard Room ${num}`, 1200, 'available', imgs(['https://images.unsplash.com/photo-1618773928121-c32242e63f39?w=800', 'https://images.unsplash.com/photo-1595526114035-0d45ed16cfbf?w=800']), 'WiFi,TV,Shower,Air Con');
            }
            stmt.finalize();
        }
    });

    db.get("SELECT count(*) as count FROM settings", (err, row) => {
        if (row && row.count === 0) {
            console.log("Seeding Settings...");
            const defaultSettings = {
                brand: { 
                    name_th: 'SERENITY', name_en: 'Experience Luxury', slogan: 'พักผ่อนในบรรยากาศสุดพิเศษ พร้อมบริการระดับ 5 ดาว', 
                    address: '123 Beach Road, Phuket', phone: '02-123-4567', email: 'info@serenity.com', 
                    logo: '', lat: '', lng: '', line_oa: '', checkin: '14:00', checkout: '12:00', 
                    policy: 'No refund', currency: 'THB', lang: 'TH' 
                },
                social: { facebook: '', line: '', instagram: '' },
                theme: { 
                    primary: '#c5a028', secondary: '#1a202c', font: 'Prompt', size: '16',
                    banner: 'https://images.unsplash.com/photo-1566073771259-6a8506099945?auto=format&fit=crop&w=1920&q=80' 
                },
                seo: { title: 'The Serenity Residence | Phuket', desc: 'Luxury Hotel in Phuket Thailand', keywords: 'hotel, travel' },
                payment_methods: [{ id: 'bank', name: 'โอนเงินผ่านบัญชีธนาคาร', enabled: true, details: 'กสิกรไทย 123-4-56789-0' }, { id: 'card', name: 'บัตรเครดิต', enabled: true, details: 'Stripe/Omise' }]
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
        // Upsert settings
        db.run("INSERT OR REPLACE INTO settings (id, data) VALUES (1, ?)", [JSON.stringify(data)], function(err) {
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
    console.log(`Note: To see multiple images, you might need to delete 'hotel.db' to re-seed data.`);
});
