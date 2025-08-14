# PocketBase Setup Instructions

## 1. Download and Install PocketBase

1. Go to https://pocketbase.io/docs/
2. Download PocketBase for Windows
3. Extract the executable to your project root or a dedicated folder
4. Run PocketBase: `./pocketbase serve`
5. Access admin UI at: http://127.0.0.1:8090/_/

## 2. Create Admin Account

1. Open http://127.0.0.1:8090/_/
2. Create your admin account (email/password)

## 3. Create Collections

### 3.1 Users Collection (should be auto-created)
- Go to Collections > users
- Verify these fields exist:
  - `email` (email, unique, required)
  - `name` (text, required)
  - `credits` (number, default: 100)
  - `avatar` (file, optional)

### 3.2 Videos Collection
Create new collection named `videos`:
- `user` (relation to users, required)
- `title` (text, required)
- `story_input` (text, required)
- `visual_style` (text, required)
- `quality` (select: LOW, HIGH, MAX, required)
- `video_url` (url, required)
- `thumbnail_url` (url, optional)
- `duration` (number, optional)
- `file_size` (number, optional)
- `status` (select: processing, completed, failed, default: completed)

### 3.3 Generation Jobs Collection
Create new collection named `generation_jobs`:
- `user` (relation to users, required)
- `status` (select: queued, processing, completed, failed, required)
- `story_input` (text, required)
- `visual_style` (text, required)
- `quality` (select: LOW, HIGH, MAX, required)
- `input_type` (select: text, pdf, youtube, required)
- `video` (relation to videos, optional)
- `error_message` (text, optional)
- `progress_data` (json, optional)

### 3.4 Scenes Collection
Create new collection named `scenes`:
- `video` (relation to videos, required)
- `job` (relation to generation_jobs, required)
- `scene_order` (number, required)
- `image_description` (text, required)
- `narration` (text, required)
- `image_url` (url, optional)
- `audio_url` (url, optional)
- `duration` (number, optional)

### 3.5 Credit Transactions Collection
Create new collection named `credit_transactions`:
- `user` (relation to users, required)
- `type` (select: purchase, spend, refund, bonus, required)
- `amount` (number, required)
- `description` (text, required)
- `job` (relation to generation_jobs, optional)
- `payment_reference` (text, optional)

### 3.6 User Sessions Collection
Create new collection named `user_sessions`:
- `user` (relation to users, required)
- `token` (text, required, unique)
- `expires_at` (date, required)
- `user_agent` (text, optional)
- `ip_address` (text, optional)

## 4. Set Collection Permissions

For each collection, set these API rules:

### Users Collection:
- List rule: `@request.auth.id != ""`
- View rule: `id = @request.auth.id`
- Create rule: `""` (empty - allows public registration)
- Update rule: `id = @request.auth.id`
- Delete rule: `id = @request.auth.id`

### Videos Collection:
- List rule: `user = @request.auth.id`
- View rule: `user = @request.auth.id`
- Create rule: `user = @request.auth.id`
- Update rule: `user = @request.auth.id`
- Delete rule: `user = @request.auth.id`

### Generation Jobs Collection:
- List rule: `user = @request.auth.id`
- View rule: `user = @request.auth.id`
- Create rule: `user = @request.auth.id`
- Update rule: `user = @request.auth.id`
- Delete rule: `user = @request.auth.id`

### Scenes Collection:
- List rule: `video.user = @request.auth.id`
- View rule: `video.user = @request.auth.id`
- Create rule: `video.user = @request.auth.id`
- Update rule: `video.user = @request.auth.id`
- Delete rule: `video.user = @request.auth.id`

### Credit Transactions Collection:
- List rule: `user = @request.auth.id`
- View rule: `user = @request.auth.id`
- Create rule: `user = @request.auth.id`
- Update rule: `""` (empty - no updates allowed)
- Delete rule: `""` (empty - no deletions allowed)

### User Sessions Collection:
- List rule: `user = @request.auth.id`
- View rule: `user = @request.auth.id`
- Create rule: `user = @request.auth.id`
- Update rule: `user = @request.auth.id`
- Delete rule: `user = @request.auth.id`

## 5. Configure Authentication

1. Go to Settings > Auth
2. Enable email/password authentication
3. Set minimum password length (e.g., 8 characters)
4. Configure email verification if needed

## 6. Test the Setup

1. Start PocketBase: `./pocketbase serve`
2. Start your Next.js app: `npm run dev`
3. Try creating an account at http://localhost:3000/signup
4. Test video generation functionality

## 7. Environment Variables

Make sure your `.env.local` has:
```
NEXT_PUBLIC_POCKETBASE_URL=http://127.0.0.1:8090
POCKETBASE_URL=http://127.0.0.1:8090
```

## 8. Production Deployment

For production:
1. Deploy PocketBase to your server
2. Update environment variables with production URLs
3. Configure proper SSL certificates
4. Set up automated backups
5. Configure file storage (local or S3-compatible)

## Troubleshooting

- If you get CORS errors, check PocketBase settings
- If auth doesn't work, verify collection permissions
- If files don't upload, check PocketBase file storage settings
- Check browser console and PocketBase logs for errors