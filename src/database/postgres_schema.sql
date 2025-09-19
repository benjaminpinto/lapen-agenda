CREATE TABLE courts (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) UNIQUE NOT NULL,
    type VARCHAR(100) NOT NULL,
    description TEXT,
    active BOOLEAN DEFAULT TRUE,
    image_url TEXT
);

CREATE TABLE players (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) UNIQUE NOT NULL
);

CREATE TABLE holidays_blocks (
    id SERIAL PRIMARY KEY,
    date DATE NOT NULL,
    start_time TIME,
    end_time TIME,
    description TEXT
);

CREATE TABLE schedules (
    id SERIAL PRIMARY KEY,
    court_id INTEGER NOT NULL,
    date DATE NOT NULL,
    start_time TIME NOT NULL,
    player1_name VARCHAR(255) NOT NULL,
    player2_name VARCHAR(255) NOT NULL,
    match_type VARCHAR(50) NOT NULL,
    FOREIGN KEY (court_id) REFERENCES courts(id)
);

CREATE TABLE recurring_schedules (
    id SERIAL PRIMARY KEY,
    court_id INTEGER NOT NULL,
    day_of_week INTEGER NOT NULL,
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    description TEXT,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    FOREIGN KEY (court_id) REFERENCES courts(id)
);