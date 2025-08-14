# WP Filler - WordPress Landing Page Automation

Automated WordPress landing page creation system using Playwright. Receives data from N8N/NocoDB and automatically fills ACF (Advanced Custom Fields) forms to create landing pages.

## 🚀 Quick Start

### Prerequisites
- Node.js 18+ (for local development)
- Docker & Docker Compose (for production)
- WordPress site with:
  - ACF (Advanced Custom Fields) plugin
  - Custom post type "landing"
  - Configured field groups matching the mapping

### Installation

1. **Clone the repository:**
```bash
git clone https://github.com/pranitl/wp-filler.git
cd wp-filler
```

2. **Copy environment template:**
```bash
cp .env.example .env
```

3. **Configure `.env` file:**
```env
WP_ADMIN_URL=https://your-site.com/wp-admin
WP_USERNAME=your_username
WP_PASSWORD=your_password
```

4. **Install dependencies (for local development):**
```bash
npm install
```

## 🐳 Docker Deployment (Recommended)

### Production Mode
```bash
# Build and run with Docker Compose
docker-compose up -d

# Or manually with Docker
docker build -t wp-filler .
docker run -p 3000:3000 --env-file .env wp-filler
```

### Development Mode
```bash
# Run with visible browser (non-headless)
docker-compose --profile dev up wp-filler-dev
```

## 💻 Local Development

### Run the server:
```bash
npm start
```

### Run in development mode:
```bash
npm run dev
```

### Run tests:
```bash
# Test automation phases
npm test

# Test API endpoints
npm test -- --api
```

## 📡 API Endpoints

### Create Landing Page
**POST** `/create-landing`

**Headers:**
```json
{
  "Content-Type": "application/json",
  "x-webhook-secret": "your_webhook_secret" // Optional
}
```

**Payload:**
```json
{
  "header_headline": "Professional Home Care",
  "hero_text_left": "Compassionate",
  "hero_text_right": "Care Services",
  "hero_preposition": "in",
  "hero_territories_csv": "New York, Brooklyn, Queens",
  "hero_excerpt": "Quality care when you need it",
  "hero_btn1_text": "Get Started",
  "hero_btn1_url": "https://example.com/contact",
  "hero_btn2_text": "Learn More",
  "hero_btn2_url": "https://example.com/about",
  "intro_headline": "Welcome to Our Services",
  "intro_html": "<p>Professional care services...</p>",
  "cta_headline": "Ready to Begin?",
  "cta_text": "Contact us for a consultation",
  "below_headline": "<p>Trusted by families...</p>",
  "svc1_name": "Personal Care",
  "svc2_name": "Home Care",
  "svc3_name": "Companion Care",
  "svc4_name": "Dementia Care"
}
```

### Health Check
**GET** `/health`

Returns server status and version.

### Test Endpoint (Dev Only)
**POST** `/test`

Creates a test landing page with sample data.

## 🔧 Configuration

### Field Mapping
Edit `config/mapping.json` to update field selectors if your WordPress setup changes:

```json
{
  "panels": [...],
  "fields": [
    {
      "payloadKey": "field_name",
      "type": "text|select|textarea|tinymce",
      "selector": "#css-selector",
      "panel": "panel_key"
    }
  ]
}
```

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `WP_ADMIN_URL` | WordPress admin URL | Required |
| `WP_USERNAME` | WordPress username | Required |
| `WP_PASSWORD` | WordPress password | Required |
| `PORT` | Server port | 3000 |
| `HEADLESS` | Run browser in headless mode | false |
| `DEBUG_MODE` | Enable debug logging | true |
| `SCREENSHOT_ON_ERROR` | Take screenshots on errors | true |
| `WEBHOOK_SECRET` | Optional webhook authentication | - |

## 🔄 N8N Integration

1. Add HTTP Request node in N8N
2. Set method to POST
3. URL: `http://your-server:3000/create-landing`
4. Add data transformation to match payload structure
5. Optional: Add webhook secret header for security

## 🧪 Testing Workflow

### Phase Testing
The test script runs through phases sequentially:
1. Login to WordPress
2. Navigate to new landing page
3. Fill Hero Area fields
4. Fill Intro Content
5. Fill Call to Action
6. Fill Below Form
7. Fill Services Grid
8. Publish (optional)

### Run Specific Phases
Edit `tests/test-automation.js` to enable/disable phases:
```javascript
phases: {
  login: true,
  navigation: true,
  heroArea: true,
  // ... etc
  publish: false // Set to true to actually publish
}
```

## 📝 Troubleshooting

### Common Issues

**Selector Not Found:**
- Check `config/mapping.json` for correct selectors
- Verify ACF field configuration in WordPress
- Run test script to identify failing selector

**Login Failed:**
- Verify credentials in `.env`
- Check WordPress URL includes `/wp-admin`
- Ensure user has permission to create landing pages

**Docker Issues:**
- Ensure ports 3000 (prod) or 3001 (dev) are available
- Check Docker logs: `docker-compose logs -f`
- Verify `.env` file is in project root

### Debug Mode
Enable detailed logging:
```env
DEBUG_MODE=true
LOG_LEVEL=debug
SCREENSHOT_ON_ERROR=true
```

Screenshots are saved to `logs/screenshots/` on errors.

## 🏗️ Project Structure

```
wp-filler/
├── src/
│   └── server.js         # Main application server
├── config/
│   └── mapping.json      # Field selector mappings
├── tests/
│   └── test-automation.js # Test suite
├── logs/                 # Logs and screenshots
├── .env.example          # Environment template
├── Dockerfile            # Container configuration
├── docker-compose.yml    # Docker orchestration
└── package.json          # Dependencies
```

## 🔒 Security Notes

- Never commit `.env` file
- Use strong passwords
- Enable `WEBHOOK_SECRET` in production
- Run container as non-root user
- Regularly update dependencies

## 📄 License

MIT

## 🤝 Contributing

1. Fork the repository
2. Create feature branch
3. Test thoroughly
4. Submit pull request

## 📞 Support

For issues or questions, open an issue on GitHub.