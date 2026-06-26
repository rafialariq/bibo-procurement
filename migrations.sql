-- Mengaktifkan ekstensi UUID generator
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. Tabel Departemen
CREATE TABLE departments (
    name TEXT PRIMARY KEY
);

-- 2. Tabel Kategori Budget
CREATE TABLE categories (
    name TEXT PRIMARY KEY
);

-- 3. Tabel Request Budget
CREATE TABLE requests (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    number TEXT NOT NULL,
    date DATE NOT NULL,
    "requesterId" TEXT NOT NULL,
    "requesterName" TEXT NOT NULL,
    department TEXT NOT NULL,
    category TEXT NOT NULL,
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    amount NUMERIC NOT NULL,
    attachment JSONB,
    "attachmentName" TEXT,
    "approvalNote" TEXT,
    status TEXT NOT NULL,
    "currentLevel" INTEGER DEFAULT 1,
    "createdAt" TIMESTAMPTZ DEFAULT NOW(),
    "updatedAt" TIMESTAMPTZ DEFAULT NOW(),
    history JSONB DEFAULT '[]'::jsonb
);

-- 4. Tabel Notifikasi
CREATE TABLE notifications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    message TEXT NOT NULL,
    "requestId" UUID REFERENCES requests(id) ON DELETE CASCADE,
    date TIMESTAMPTZ DEFAULT NOW()
);
