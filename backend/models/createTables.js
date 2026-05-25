const pool = require('../config/db');

const createTables = async () => {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS users (
        user_id       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        phone_number  VARCHAR(15) UNIQUE NOT NULL,
        name          VARCHAR(100),
        photo_url     TEXT,
        role          VARCHAR(20) CHECK (role IN ('customer', 'worker', 'thekedar')),
        language      VARCHAR(10) DEFAULT 'hi',
        is_verified   BOOLEAN DEFAULT false,
        is_active     BOOLEAN DEFAULT true,
        created_at    TIMESTAMP DEFAULT NOW(),
        updated_at    TIMESTAMP DEFAULT NOW()
      );
    `);
    console.log('✅ users table ready');

    await pool.query(`
      CREATE TABLE IF NOT EXISTS otp_verifications (
        otp_id        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        phone_number  VARCHAR(15) NOT NULL,
        otp_code      VARCHAR(6) NOT NULL,
        is_used       BOOLEAN DEFAULT false,
        expires_at    TIMESTAMP NOT NULL,
        created_at    TIMESTAMP DEFAULT NOW()
      );
    `);
    console.log('✅ otp_verifications table ready');

    await pool.query(`
      CREATE TABLE IF NOT EXISTS worker_profiles (
        worker_id         UUID PRIMARY KEY REFERENCES users(user_id),
        category          VARCHAR(50),
        worker_type       VARCHAR(20) CHECK (worker_type IN ('daily', 'contract', 'both')),
        daily_rate        DECIMAL(10,2),
        experience_years  INTEGER DEFAULT 0,
        skills            TEXT,
        aadhar_url        TEXT,
        latitude          DECIMAL(10,8),
        longitude         DECIMAL(11,8),
        is_available      BOOLEAN DEFAULT true,
        avg_rating        DECIMAL(3,2) DEFAULT 0,
        total_reviews     INTEGER DEFAULT 0,
        is_id_verified    BOOLEAN DEFAULT false,
        updated_at        TIMESTAMP DEFAULT NOW()
      );
    `);
    console.log('✅ worker_profiles table ready');

    await pool.query(`
      CREATE TABLE IF NOT EXISTS job_requests (
        request_id        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        hired_by_id       UUID REFERENCES users(user_id),
        worker_id         UUID REFERENCES users(user_id),
        work_description  TEXT,
        work_location     TEXT,
        work_type         VARCHAR(20) CHECK (work_type IN ('daily', 'contract')),
        start_date        DATE,
        status            VARCHAR(20) DEFAULT 'pending'
                          CHECK (status IN ('pending','accepted','rejected','completed','cancelled')),
        created_at        TIMESTAMP DEFAULT NOW()
      );
    `);
    console.log('✅ job_requests table ready');

    await pool.query(`
      CREATE TABLE IF NOT EXISTS active_jobs (
        job_id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        request_id           UUID REFERENCES job_requests(request_id),
        worker_id            UUID REFERENCES users(user_id),
        hired_by_id          UUID REFERENCES users(user_id),
        job_status           VARCHAR(20) DEFAULT 'accepted'
                             CHECK (job_status IN ('accepted','traveling','working','completed')),
        location_sharing     BOOLEAN DEFAULT false,
        worker_latitude      DECIMAL(10,8),
        worker_longitude     DECIMAL(11,8),
        last_location_update TIMESTAMP,
        started_at           TIMESTAMP,
        completed_at         TIMESTAMP
      );
    `);
    console.log('✅ active_jobs table ready');

    await pool.query(`
      CREATE TABLE IF NOT EXISTS attendance (
        attendance_id   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        worker_id       UUID REFERENCES users(user_id),
        thekedar_id     UUID REFERENCES users(user_id),
        date            DATE NOT NULL,
        status          VARCHAR(20) CHECK (status IN ('present','absent','half_day')),
        daily_rate      DECIMAL(10,2),
        created_at      TIMESTAMP DEFAULT NOW(),
        UNIQUE(worker_id, thekedar_id, date)
      );
    `);
    console.log('✅ attendance table ready');

    await pool.query(`
      CREATE TABLE IF NOT EXISTS daily_salary_payments (
        payment_id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        worker_id             UUID REFERENCES users(user_id),
        thekedar_id           UUID REFERENCES users(user_id),
        month                 VARCHAR(7) NOT NULL,
        total_days_present    INTEGER,
        daily_rate            DECIMAL(10,2),
        total_amount          DECIMAL(10,2),
        payment_mode          VARCHAR(20) CHECK (payment_mode IN ('cash','upi','bank')),
        proof_image_url       TEXT,
        thekedar_confirmed    BOOLEAN DEFAULT false,
        thekedar_confirmed_at TIMESTAMP,
        worker_confirmed      BOOLEAN DEFAULT false,
        worker_confirmed_at   TIMESTAMP,
        status                VARCHAR(20) DEFAULT 'pending'
                              CHECK (status IN ('pending','confirmed','disputed')),
        created_at            TIMESTAMP DEFAULT NOW()
      );
    `);
    console.log('✅ daily_salary_payments table ready');

    await pool.query(`
      CREATE TABLE IF NOT EXISTS contracts (
        contract_id       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        worker_id         UUID REFERENCES users(user_id),
        thekedar_id       UUID REFERENCES users(user_id),
        project_name      TEXT NOT NULL,
        total_amount      DECIMAL(10,2) NOT NULL,
        paid_amount       DECIMAL(10,2) DEFAULT 0,
        remaining_amount  DECIMAL(10,2),
        start_date        DATE,
        expected_end_date DATE,
        actual_end_date   DATE,
        status            VARCHAR(20) DEFAULT 'ongoing'
                          CHECK (status IN ('ongoing','completed','disputed')),
        created_at        TIMESTAMP DEFAULT NOW()
      );
    `);
    console.log('✅ contracts table ready');

    await pool.query(`
      CREATE TABLE IF NOT EXISTS contract_payments (
        payment_id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        contract_id           UUID REFERENCES contracts(contract_id),
        amount                DECIMAL(10,2) NOT NULL,
        payment_mode          VARCHAR(20) CHECK (payment_mode IN ('cash','upi','bank')),
        payment_date          DATE DEFAULT CURRENT_DATE,
        proof_image_url       TEXT,
        thekedar_confirmed    BOOLEAN DEFAULT true,
        thekedar_confirmed_at TIMESTAMP DEFAULT NOW(),
        worker_confirmed      BOOLEAN DEFAULT false,
        worker_confirmed_at   TIMESTAMP,
        status                VARCHAR(20) DEFAULT 'pending'
                              CHECK (status IN ('pending','confirmed','disputed')),
        created_at            TIMESTAMP DEFAULT NOW()
      );
    `);
    console.log('✅ contract_payments table ready');

    await pool.query(`
      CREATE TABLE IF NOT EXISTS reviews (
        review_id       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        worker_id       UUID REFERENCES users(user_id),
        reviewed_by_id  UUID REFERENCES users(user_id),
        reviewer_type   VARCHAR(20) CHECK (reviewer_type IN ('customer','thekedar')),
        job_id          UUID,
        rating          INTEGER CHECK (rating BETWEEN 1 AND 5),
        review_text     TEXT,
        created_at      TIMESTAMP DEFAULT NOW()
      );
    `);
    console.log('✅ reviews table ready');

    await pool.query(`
      CREATE TABLE IF NOT EXISTS disputes (
        dispute_id        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        payment_id        UUID NOT NULL,
        payment_type      VARCHAR(20) CHECK (payment_type IN ('daily','contract')),
        raised_by_id      UUID REFERENCES users(user_id),
        reason            TEXT,
        proof_image_url   TEXT,
        status            VARCHAR(20) DEFAULT 'open'
                          CHECK (status IN ('open','resolved')),
        resolved_by       UUID,
        resolved_at       TIMESTAMP,
        created_at        TIMESTAMP DEFAULT NOW()
      );
    `);
    console.log('✅ disputes table ready');

    await pool.query(`
      CREATE TABLE IF NOT EXISTS messages (
        message_id    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        sender_id     UUID REFERENCES users(user_id),
        receiver_id   UUID REFERENCES users(user_id),
        job_id        UUID,
        message_text  TEXT NOT NULL,
        is_read       BOOLEAN DEFAULT false,
        created_at    TIMESTAMP DEFAULT NOW()
      );
    `);
    console.log('✅ messages table ready');

    console.log('\n🎉 All tables created successfully!');
    process.exit(0);

  } catch (err) {
    console.error('❌ Error creating tables:', err.message);
    process.exit(1);
  }
};

createTables();