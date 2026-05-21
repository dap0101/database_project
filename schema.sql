
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";


CREATE TABLE users (
    id UUID PRIMARY KEY,
    
    email VARCHAR(255) NOT NULL,
    
    school_name VARCHAR(100) NOT NULL,
    
    student_name VARCHAR(50) NOT NULL,
    
    student_id VARCHAR(20) NOT NULL,
    
    phone_or_email VARCHAR(100),
    
    is_verified BOOLEAN DEFAULT FALSE,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    CONSTRAINT users_email_unique UNIQUE (email),
    CONSTRAINT users_student_id_unique UNIQUE (student_id),
    CONSTRAINT users_student_id_check CHECK (student_id ~ '^[A-Za-z0-9]+$')
);

CREATE INDEX idx_users_school ON users(school_name);
CREATE INDEX idx_users_verified ON users(is_verified);
CREATE INDEX idx_users_created_at ON users(created_at);

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_users_updated_at
    BEFORE UPDATE ON users
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();


CREATE TABLE posts (
    id BIGSERIAL PRIMARY KEY,
    
    user_id UUID NOT NULL,
    
    shop_name VARCHAR(200) NOT NULL,
    
    rating INTEGER NOT NULL,
    
    title VARCHAR(200) NOT NULL,
    
    content TEXT NOT NULL,
    
    type VARCHAR(10) NOT NULL,
    
    tags TEXT[] DEFAULT '{}',
    
    is_anonymous BOOLEAN DEFAULT FALSE,
    
    is_deleted BOOLEAN DEFAULT FALSE,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    CONSTRAINT fk_posts_user_id
        FOREIGN KEY (user_id) 
        REFERENCES users(id) 
        ON DELETE CASCADE,
    
    CONSTRAINT posts_rating_check 
        CHECK (rating >= 1 AND rating <= 5),
    
    CONSTRAINT posts_type_check 
        CHECK (type IN ('RED', 'BLACK'))
);


CREATE INDEX idx_posts_shop_rating ON posts(shop_name, rating);

CREATE INDEX idx_posts_user_id ON posts(user_id);
CREATE INDEX idx_posts_created_at ON posts(created_at DESC);
CREATE INDEX idx_posts_type ON posts(type);
CREATE INDEX idx_posts_is_deleted ON posts(is_deleted);

CREATE INDEX idx_posts_tags ON posts USING GIN(tags);

CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE INDEX idx_posts_shop_name_trgm ON posts USING GIN(shop_name gin_trgm_ops);

CREATE TRIGGER update_posts_updated_at
    BEFORE UPDATE ON posts
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();


CREATE VIEW shop_rating_stats AS
SELECT 
    shop_name,
    COUNT(*) as total_reviews,
    AVG(rating) as avg_rating,
    COUNT(*) FILTER (WHERE rating = 5) as five_star_count,
    COUNT(*) FILTER (WHERE rating = 4) as four_star_count,
    COUNT(*) FILTER (WHERE rating = 3) as three_star_count,
    COUNT(*) FILTER (WHERE rating = 2) as two_star_count,
    COUNT(*) FILTER (WHERE rating = 1) as one_star_count,
    MAX(created_at) as last_review_date
FROM posts
WHERE is_deleted = FALSE
GROUP BY shop_name;

CREATE INDEX idx_posts_shop_name ON posts(shop_name);

ALTER TABLE users ENABLE ROW LEVEL SECURITY;

CREATE POLICY users_select_own ON users
    FOR SELECT
    USING (id = auth.uid());

CREATE POLICY users_update_own ON users
    FOR UPDATE
    USING (id = auth.uid());

ALTER TABLE posts ENABLE ROW LEVEL SECURITY;

CREATE POLICY posts_select_all ON posts
    FOR SELECT
    USING (is_deleted = FALSE);

CREATE POLICY posts_insert_own ON posts
    FOR INSERT
    WITH CHECK (user_id = auth.uid());

CREATE POLICY posts_update_own ON posts
    FOR UPDATE
    USING (user_id = auth.uid());

CREATE POLICY posts_delete_own ON posts
    FOR DELETE
    USING (user_id = auth.uid());


COMMENT ON TABLE users IS '用户表，存储实名认证信息，与Supabase Auth集成';
COMMENT ON TABLE posts IS '帖子表，存储用户对店铺的评价内容';
COMMENT ON VIEW shop_rating_stats IS '店铺评分统计视图，预聚合各店铺的评分数据';

SELECT 'Database schema created successfully!' as status;
