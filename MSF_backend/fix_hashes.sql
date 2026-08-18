BEGIN;
UPDATE users SET password = 'pbkdf2_sha256$870000$a17aa3d62ff201b6ee1e93e692866a1c$dj0pEej/o4hwc8qxAKZU7x6hMzoj7kNa7IadoDNe2P4=' WHERE email != 'superadmin@msf.org';
UPDATE users SET password = 'pbkdf2_sha256$870000$395c9dc8efa54e32d794f98f48cd19a3$8qj8WrBPB1+BxymPD4UJEULNXMYUdgGE3D0hEy+fw/U=' WHERE email = 'superadmin@msf.org';
COMMIT;
