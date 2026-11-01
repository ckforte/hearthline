CREATE TRIGGER users_limit_two_per_household
BEFORE INSERT ON users
WHEN (SELECT COUNT(*) FROM users WHERE household_id = NEW.household_id) >= 2
BEGIN
  SELECT RAISE(ABORT, 'household account limit reached');
END;
