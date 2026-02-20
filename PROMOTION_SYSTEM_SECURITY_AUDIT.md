# Promotion System Security Audit Report

**Date:** 2026-01-24
**Scope:** PromotionSetupModal.tsx + Backend Logic
**Risk Level:** 🔴 **HIGH - CRITICAL VULNERABILITIES FOUND**

---

## Executive Summary

The promotion system has **CRITICAL SECURITY GAPS** that allow malicious users to:
- Bypass client-side validation by directly calling database APIs
- Create unlimited promotions without proper server-side quota enforcement
- Manipulate costs by tampering with client-calculated values
- Abuse the system without adequate rate limiting or fraud detection

**Immediate Action Required:** Implement server-side validation, quota enforcement, and anti-fraud controls.

---

## Current Security Measures (What Exists)

### ✅ Good - What's Working

1. **Row Level Security (RLS) Enabled**
   - Users can only view/manage their own promotions
   - Admin-only access to settings
   - Service role access for automation

2. **Wallet Balance Checking**
   - Database trigger validates sufficient balance before deduction
   - Transaction atomicity via `deduct_treats_on_promotion_insert()`
   - Prevents negative balances

3. **Basic Input Validation**
   - Promotion type constraint (CHECK)
   - Status constraint validation
   - Required fields enforced

4. **Auto-deduction System**
   - Treats automatically deducted on promotion creation
   - Transaction logging for audit trail

5. **Global Settings**
   - `max_active_promotions_per_user` = 5 (default)
   - `min_treats_balance` = 100 (default)
   - `promotions_enabled` toggle

---

## 🔴 CRITICAL VULNERABILITIES

### 1. **NO SERVER-SIDE QUOTA ENFORCEMENT** 🚨
**Risk: CRITICAL**

**Problem:**
- `max_active_promotions_per_user` setting exists but **IS NOT ENFORCED**
- No database trigger or constraint checks active promotion count
- Users can bypass UI and create unlimited promotions via direct API calls

**Attack Vector:**
```javascript
// Malicious user bypasses modal entirely
for (let i = 0; i < 1000; i++) {
  await supabase.from('promotions').insert({
    user_id: attackerUserId,
    promotion_type: 'song',
    target_id: songId,
    promotion_section_id: sectionId,
    treats_cost: 800,
    duration_hours: 24,
    duration_days: 1,
    start_date: new Date(),
    end_date: new Date(Date.now() + 86400000),
    status: 'pending_approval'
  });
}
// Result: 1000 promotions created, wallet drained, system overload
```

**Current Code (Client-side only):**
```typescript
// PromotionSetupModal.tsx:411 - NO SERVER VALIDATION
const { error: promotionError } = await supabase
  .from('promotions')
  .insert(promotionData) // ❌ No quota check!
  .select('id')
  .single();
```

---

### 2. **NO CREATOR ELIGIBILITY VALIDATION** 🚨
**Risk: CRITICAL**

**Problem:**
- Modal checks creator status (line 127-150) but **ONLY IN UI**
- No database-level check that user is an approved creator
- Listeners can create promotions by bypassing the modal

**Attack Vector:**
```sql
-- Non-creator directly inserts promotion
INSERT INTO promotions (user_id, promotion_type, target_id, ...)
VALUES (listener_user_id, 'song', any_song_id, ...);
-- Result: Listener successfully promotes content without creator status
```

**Current Code:**
```typescript
// PromotionSetupModal.tsx:127-151 - UI check only
const getCreatorStatus = async (): Promise<boolean> => {
  const { data } = await supabase
    .from('artist_profiles')
    .select('id')
    .eq('user_id', user.id)
    .maybeSingle();
  return !!data; // ❌ No database enforcement!
};
```

---

### 3. **CLIENT-CALCULATED COSTS TRUSTED** 🚨
**Risk: HIGH**

**Problem:**
- Cost calculation happens client-side (line 283-287)
- Client sends `treats_cost` value to database
- No server-side recalculation or validation of cost

**Attack Vector:**
```javascript
// Malicious user tampers with cost
await supabase.from('promotions').insert({
  promotion_type: 'song',
  promotion_section_id: premiumSectionId, // $1500 section
  treats_cost: 1, // ❌ Claims it costs 1 treat!
  duration_days: 30 // 30 days for 1 treat
});
// Result: Premium 30-day promotion for 1 treat
```

**Current Code:**
```typescript
// PromotionSetupModal.tsx:283-287 - Client calculation
const calculateCost = (): number => {
  if (!selectedSection) return 0;
  const dailyPrice = Number(selectedSection.treats_cost);
  return dailyPrice * durationDays; // ❌ Client-controlled!
};

// Line 394-408 - Client value sent to DB
const promotionData = {
  treats_cost: treatsCost, // ❌ Trusts client calculation
  duration_hours: actualDurationHours,
  duration_days: actualDurationDays
};
```

---

### 4. **NO RATE LIMITING ON PROMOTION CREATION** 🚨
**Risk: HIGH**

**Problem:**
- Rate limiting system exists but doesn't cover promotion endpoints
- No throttling on promotion creation
- Allows spam/DOS attacks

**Attack Vector:**
```javascript
// Create 10,000 promotions in 60 seconds
async function spamPromotions() {
  const promises = [];
  for (let i = 0; i < 10000; i++) {
    promises.push(
      supabase.from('promotions').insert({...})
    );
  }
  await Promise.all(promises);
}
// Result: Database overload, service degradation
```

**Evidence:**
```sql
-- supabase/migrations/20251028124238_implement_rate_limiting_system.sql
INSERT INTO rate_limit_config (endpoint_pattern, ...) VALUES
  ('/auth/signin', 10, 100, 1000),
  ('/process-payment', 5, 50, 500),
  -- ❌ NO RATE LIMIT FOR PROMOTIONS!
  ('/*', 60, 1000, 10000); -- Generic fallback only
```

---

### 5. **NO OWNERSHIP VALIDATION** 🚨
**Risk: HIGH**

**Problem:**
- Users can promote content they don't own
- No validation that `target_id` belongs to the user
- Allows promotional manipulation of others' content

**Attack Vector:**
```javascript
// User promotes someone else's viral song
await supabase.from('promotions').insert({
  user_id: attackerUserId,
  target_id: viralSongId, // ❌ Not attacker's song!
  promotion_type: 'song',
  // ... Attacker pays to promote competitor's song
  // OR uses it to drain their own treats on purpose
});
```

---

### 6. **NO ANTI-FRAUD DETECTION** 🚨
**Risk: HIGH**

**Problem:**
- No pattern detection for suspicious behavior
- No monitoring for:
  - Multiple accounts from same IP
  - Rapid creation/cancellation cycles
  - Abnormal spending patterns
  - Coordinated attacks

**Missing Controls:**
- IP tracking
- Device fingerprinting
- Behavioral analysis
- Anomaly detection

---

### 7. **NO COOLDOWN ENFORCEMENT AT DB LEVEL** ⚠️
**Risk: MEDIUM**

**Problem:**
- Cooldown logic exists in `get_available_promotion_sections()` RPC
- But NO database constraint prevents insertion during cooldown
- Users can bypass by calling INSERT directly

**Attack Vector:**
```javascript
// Promote same song repeatedly without waiting
for (let i = 0; i < 10; i++) {
  await supabase.from('promotions').insert({
    target_id: sameSongId,
    promotion_section_id: sameSectionId,
    status: 'pending_approval'
  });
  // No cooldown enforcement!
}
```

---

### 8. **NO DAILY/WEEKLY SPENDING LIMITS** ⚠️
**Risk: MEDIUM**

**Problem:**
- Users can spend entire balance in one transaction
- No velocity checks on spending
- No daily/weekly caps

**Scenario:**
- User has 100,000 treats (purchased or earned)
- Creates 100 promotions instantly, draining balance
- If compromised account, attacker can burn all treats

---

### 9. **INADEQUATE INPUT SANITIZATION** ⚠️
**Risk: MEDIUM**

**Problem:**
- `target_title` not sanitized
- Potential for XSS if displayed without escaping
- No length limits on title field

**Attack Vector:**
```javascript
await supabase.from('promotions').insert({
  target_title: '<script>alert("XSS")</script>'.repeat(1000),
  // Could cause display issues or XSS
});
```

---

### 10. **NO CONCURRENT PROMOTION CHECKS** ⚠️
**Risk: MEDIUM**

**Problem:**
- No database constraint prevents same content in same section simultaneously
- Could create duplicate promotions for same target

---

## Required Mitigations (Priority Order)

### 🔴 CRITICAL - Must Fix Immediately

#### 1. Server-Side Quota Enforcement

**Create Database Trigger:**
```sql
-- REQUIRED FIX
CREATE OR REPLACE FUNCTION enforce_promotion_quotas()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_active_count integer;
  v_max_allowed integer;
  v_is_creator boolean;
  v_promotions_enabled boolean;
  v_min_balance numeric;
  v_current_balance numeric;
BEGIN
  -- Check if promotions are globally enabled
  SELECT promotions_enabled, max_active_promotions_per_user, min_treats_balance
  INTO v_promotions_enabled, v_max_allowed, v_min_balance
  FROM promotion_global_settings
  LIMIT 1;

  IF NOT v_promotions_enabled THEN
    RAISE EXCEPTION 'Promotions are currently disabled';
  END IF;

  -- Verify user is an approved creator
  SELECT EXISTS (
    SELECT 1 FROM artist_profiles
    WHERE user_id = NEW.user_id
  ) INTO v_is_creator;

  IF NOT v_is_creator THEN
    RAISE EXCEPTION 'User must be an approved creator to create promotions';
  END IF;

  -- Check active promotion count
  SELECT COUNT(*) INTO v_active_count
  FROM promotions
  WHERE user_id = NEW.user_id
  AND status IN ('pending_approval', 'pending', 'active')
  AND (end_date IS NULL OR end_date > now());

  IF v_active_count >= v_max_allowed THEN
    RAISE EXCEPTION 'Maximum active promotions limit reached: %/%', v_active_count, v_max_allowed;
  END IF;

  -- Verify sufficient balance (double-check even though deduction trigger also checks)
  SELECT balance INTO v_current_balance
  FROM treat_wallets
  WHERE user_id = NEW.user_id;

  IF v_current_balance < v_min_balance THEN
    RAISE EXCEPTION 'Insufficient treats balance. Minimum required: %', v_min_balance;
  END IF;

  -- Verify cost is not negative or zero
  IF NEW.treats_cost <= 0 THEN
    RAISE EXCEPTION 'Invalid promotion cost: %', NEW.treats_cost;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER enforce_promotion_quotas_trigger
BEFORE INSERT ON promotions
FOR EACH ROW
EXECUTE FUNCTION enforce_promotion_quotas();
```

#### 2. Server-Side Cost Validation

**Create Cost Validation Function:**
```sql
-- REQUIRED FIX
CREATE OR REPLACE FUNCTION validate_promotion_cost()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_expected_cost numeric;
  v_daily_rate numeric;
  v_duration_days integer;
BEGIN
  -- Get the official daily rate from pricing table
  SELECT treats_cost INTO v_daily_rate
  FROM promotion_section_pricing psp
  WHERE psp.section_id = NEW.promotion_section_id
  AND psp.content_type = NEW.promotion_type
  AND psp.is_active = true
  LIMIT 1;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Invalid promotion section or content type combination';
  END IF;

  -- Calculate expected cost
  v_duration_days := CEIL(EXTRACT(EPOCH FROM (NEW.end_date - NEW.start_date)) / 86400);
  v_expected_cost := v_daily_rate * v_duration_days;

  -- Verify client-provided cost matches server calculation
  IF ABS(NEW.treats_cost - v_expected_cost) > 0.01 THEN
    RAISE EXCEPTION 'Cost mismatch. Expected: %, Provided: %', v_expected_cost, NEW.treats_cost;
  END IF;

  -- Force server-calculated values
  NEW.treats_cost := v_expected_cost;
  NEW.duration_days := v_duration_days;
  NEW.duration_hours := v_duration_days * 24;

  RETURN NEW;
END;
$$;

CREATE TRIGGER validate_promotion_cost_trigger
BEFORE INSERT ON promotions
FOR EACH ROW
EXECUTE FUNCTION validate_promotion_cost();
```

#### 3. Ownership Validation

**Add Ownership Check:**
```sql
-- REQUIRED FIX
CREATE OR REPLACE FUNCTION validate_content_ownership()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_is_owner boolean := false;
BEGIN
  -- Skip for profile promotions (self-promotion)
  IF NEW.promotion_type = 'profile' THEN
    IF NEW.target_id::text = NEW.user_id::text THEN
      v_is_owner := true;
    END IF;

  -- Check ownership for songs
  ELSIF NEW.promotion_type = 'song' THEN
    SELECT EXISTS (
      SELECT 1 FROM songs
      WHERE id = NEW.target_id
      AND artist_id = NEW.user_id
    ) INTO v_is_owner;

  -- Check ownership for videos
  ELSIF NEW.promotion_type = 'video' THEN
    SELECT EXISTS (
      SELECT 1 FROM videos
      WHERE id = NEW.target_id
      AND artist_id = NEW.user_id
    ) INTO v_is_owner;

  -- Check ownership for albums
  ELSIF NEW.promotion_type = 'album' THEN
    SELECT EXISTS (
      SELECT 1 FROM albums
      WHERE id = NEW.target_id
      AND artist_id = NEW.user_id
    ) INTO v_is_owner;

  -- Check ownership for playlists
  ELSIF NEW.promotion_type = 'playlist' THEN
    SELECT EXISTS (
      SELECT 1 FROM playlists
      WHERE id = NEW.target_id
      AND user_id = NEW.user_id
    ) INTO v_is_owner;
  END IF;

  IF NOT v_is_owner THEN
    RAISE EXCEPTION 'User does not own the content being promoted';
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER validate_content_ownership_trigger
BEFORE INSERT ON promotions
FOR EACH ROW
EXECUTE FUNCTION validate_content_ownership();
```

#### 4. Rate Limiting for Promotions

**Add to Rate Limit Config:**
```sql
-- REQUIRED FIX
INSERT INTO rate_limit_config (endpoint_pattern, requests_per_minute, requests_per_hour, requests_per_day) VALUES
  ('/promotions/create', 5, 20, 100), -- Max 5 promotions per minute
  ('/promotions/update', 10, 50, 500),
  ('/promotions/delete', 10, 50, 500)
ON CONFLICT (endpoint_pattern) DO UPDATE SET
  requests_per_minute = EXCLUDED.requests_per_minute,
  requests_per_hour = EXCLUDED.requests_per_hour,
  requests_per_day = EXCLUDED.requests_per_day;
```

### ⚠️ HIGH PRIORITY - Fix Within 48 Hours

#### 5. Cooldown Enforcement

**Add Database Constraint:**
```sql
CREATE OR REPLACE FUNCTION enforce_promotion_cooldown()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_last_promotion_end timestamptz;
  v_cooldown_hours integer := 2;
BEGIN
  -- Check if same content was recently promoted in same section
  SELECT MAX(end_date) INTO v_last_promotion_end
  FROM promotions
  WHERE user_id = NEW.user_id
  AND target_id = NEW.target_id
  AND promotion_section_id = NEW.promotion_section_id
  AND status IN ('completed', 'active');

  IF v_last_promotion_end IS NOT NULL THEN
    IF v_last_promotion_end + (v_cooldown_hours || ' hours')::interval > NEW.start_date THEN
      RAISE EXCEPTION 'Cooldown period active. Cannot promote same content in same section until %',
        v_last_promotion_end + (v_cooldown_hours || ' hours')::interval;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER enforce_promotion_cooldown_trigger
BEFORE INSERT ON promotions
FOR EACH ROW
EXECUTE FUNCTION enforce_promotion_cooldown();
```

#### 6. Anti-Fraud Monitoring

**Create Fraud Detection Table:**
```sql
CREATE TABLE IF NOT EXISTS promotion_fraud_alerts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id),
  alert_type text NOT NULL,
  severity text NOT NULL CHECK (severity IN ('low', 'medium', 'high', 'critical')),
  description text NOT NULL,
  metadata jsonb,
  is_resolved boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX idx_promotion_fraud_alerts_user ON promotion_fraud_alerts(user_id);
CREATE INDEX idx_promotion_fraud_alerts_severity ON promotion_fraud_alerts(severity);
CREATE INDEX idx_promotion_fraud_alerts_created ON promotion_fraud_alerts(created_at);

-- Fraud detection function
CREATE OR REPLACE FUNCTION detect_promotion_fraud()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_recent_count integer;
  v_same_target_count integer;
BEGIN
  -- Check for rapid creation (more than 10 in 1 hour)
  SELECT COUNT(*) INTO v_recent_count
  FROM promotions
  WHERE user_id = NEW.user_id
  AND created_at > now() - interval '1 hour';

  IF v_recent_count > 10 THEN
    INSERT INTO promotion_fraud_alerts (user_id, alert_type, severity, description, metadata)
    VALUES (
      NEW.user_id,
      'rapid_creation',
      'high',
      'User created more than 10 promotions in 1 hour',
      jsonb_build_object('count', v_recent_count, 'promotion_id', NEW.id)
    );
  END IF;

  -- Check for same target spam (more than 3 promotions for same target)
  SELECT COUNT(*) INTO v_same_target_count
  FROM promotions
  WHERE user_id = NEW.user_id
  AND target_id = NEW.target_id
  AND status IN ('pending_approval', 'pending', 'active')
  AND created_at > now() - interval '24 hours';

  IF v_same_target_count > 3 THEN
    INSERT INTO promotion_fraud_alerts (user_id, alert_type, severity, description, metadata)
    VALUES (
      NEW.user_id,
      'same_target_spam',
      'medium',
      'User created multiple promotions for same target in 24 hours',
      jsonb_build_object('count', v_same_target_count, 'target_id', NEW.target_id)
    );
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER detect_promotion_fraud_trigger
AFTER INSERT ON promotions
FOR EACH ROW
EXECUTE FUNCTION detect_promotion_fraud();
```

#### 7. Input Sanitization

**Add Length Constraints:**
```sql
ALTER TABLE promotions
ADD CONSTRAINT promotions_target_title_length CHECK (LENGTH(target_title) <= 200);
```

### 📋 MEDIUM PRIORITY - Fix Within 1 Week

#### 8. Spending Velocity Limits

**Create spending tracker:**
```sql
CREATE TABLE IF NOT EXISTS user_spending_limits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) UNIQUE,
  daily_limit numeric DEFAULT 10000,
  weekly_limit numeric DEFAULT 50000,
  daily_spent numeric DEFAULT 0,
  weekly_spent numeric DEFAULT 0,
  last_daily_reset timestamptz DEFAULT now(),
  last_weekly_reset timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Function to check and update spending limits
CREATE OR REPLACE FUNCTION check_spending_limits()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_limits RECORD;
BEGIN
  -- Get or create spending limits
  INSERT INTO user_spending_limits (user_id)
  VALUES (NEW.user_id)
  ON CONFLICT (user_id) DO NOTHING;

  SELECT * INTO v_limits
  FROM user_spending_limits
  WHERE user_id = NEW.user_id;

  -- Reset daily if needed
  IF v_limits.last_daily_reset < CURRENT_DATE THEN
    UPDATE user_spending_limits
    SET daily_spent = 0, last_daily_reset = now()
    WHERE user_id = NEW.user_id;
    v_limits.daily_spent := 0;
  END IF;

  -- Reset weekly if needed
  IF v_limits.last_weekly_reset < (CURRENT_DATE - INTERVAL '7 days') THEN
    UPDATE user_spending_limits
    SET weekly_spent = 0, last_weekly_reset = now()
    WHERE user_id = NEW.user_id;
    v_limits.weekly_spent := 0;
  END IF;

  -- Check limits
  IF (v_limits.daily_spent + NEW.treats_cost) > v_limits.daily_limit THEN
    RAISE EXCEPTION 'Daily spending limit exceeded: %/%', v_limits.daily_spent, v_limits.daily_limit;
  END IF;

  IF (v_limits.weekly_spent + NEW.treats_cost) > v_limits.weekly_limit THEN
    RAISE EXCEPTION 'Weekly spending limit exceeded: %/%', v_limits.weekly_spent, v_limits.weekly_limit;
  END IF;

  -- Update spending
  UPDATE user_spending_limits
  SET
    daily_spent = daily_spent + NEW.treats_cost,
    weekly_spent = weekly_spent + NEW.treats_cost,
    updated_at = now()
  WHERE user_id = NEW.user_id;

  RETURN NEW;
END;
$$;

CREATE TRIGGER check_spending_limits_trigger
BEFORE INSERT ON promotions
FOR EACH ROW
EXECUTE FUNCTION check_spending_limits();
```

#### 9. Concurrent Promotion Prevention

**Add unique constraint:**
```sql
-- Prevent exact duplicates
CREATE UNIQUE INDEX idx_promotions_no_duplicates
ON promotions (user_id, target_id, promotion_section_id, start_date)
WHERE status IN ('pending_approval', 'pending', 'active');
```

---

## Additional Recommendations

### Security Best Practices

1. **Audit Logging**
   - Log all promotion creations with IP address
   - Track modification history
   - Monitor suspicious patterns

2. **Admin Alerts**
   - Real-time notifications for fraud alerts
   - Daily summary of promotion activity
   - Anomaly detection reports

3. **User Education**
   - Clear promotion guidelines
   - Cost calculator in UI
   - Refund policy explanation

4. **Regular Reviews**
   - Weekly fraud pattern analysis
   - Monthly security audits
   - Quarterly penetration testing

---

## Testing Checklist

### Before Deploying Fixes

- [ ] Test quota enforcement with 6 concurrent promotions
- [ ] Verify cost tampering is blocked
- [ ] Confirm non-creators cannot promote
- [ ] Test ownership validation for all content types
- [ ] Verify cooldown enforcement
- [ ] Test rate limiting with burst requests
- [ ] Confirm fraud detection triggers alerts
- [ ] Validate spending limits work correctly
- [ ] Test with malicious payloads

---

## Conclusion

The promotion system has a **working foundation** but **CRITICAL security gaps** that must be addressed immediately. The system trusts client input too much and lacks server-side enforcement of business rules.

**Estimated Implementation Time:**
- Critical fixes: 8-12 hours
- High priority: 4-6 hours
- Medium priority: 4-6 hours
- **Total: 16-24 hours of development**

**Risk if NOT Fixed:**
- Financial loss from cost manipulation
- System abuse and spam
- Platform reputation damage
- Potential regulatory violations
- Database overload from spam attacks

**Recommendation:** Implement Critical and High Priority fixes before next production release.
