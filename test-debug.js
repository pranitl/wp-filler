const axios = require('axios');

// Your exact test data
const testData = {
  "nc_order": 10,
  "header_headline": "Cost of In‑Home Dementia Care in Belmont",
  "hero_text_left": "Dementia Care Cost Guide",
  "hero_text_right": "Belmont, MA",
  "hero_preposition": "in",
  "hero_territories_csv": "",
  "hero_excerpt": "Transparent rates and guidance for home-based dementia care in Belmont.",
  "hero_btn1_text": "Call for a Quote",
  "hero_btn1_url": "[fl_landing_phone]",
  "hero_btn2_text": "Compare Care Options",
  "hero_btn2_url": "/home-care-services/dementia-care/",
  "intro_headline": "What Does Dementia Care Cost in Belmont?",
  "intro_html": "<p>Planning for Dementia Care in Belmont starts with clear numbers.</p>",
  "cta_headline": "Get Your Custom Quote Today",
  "cta_text": "Call [fl_landing_phone] for your free consultation.",
  "below_headline": "Transparent Pricing, Local Expertise",
  "below_text": "You deserve straight answers on cost. In-home dementia care in Belmont typically ranges from $45–$55 per hour.",
  "bottom_cta_headline": "See How Care Fits Your Budget",
  "bottom_cta_link_text": "Explore Dementia Care",
  "bottom_cta_link_url": "/home-care-services/dementia-care/",
  "svc1_name": "Dementia Care",
  "svc2_name": "Personal Care",
  "svc3_name": "Respite Care",
  "svc4_name": "Live-In Care",
  "page_design": "c"
};

async function testDebug() {
  console.log('🧪 Testing with debug logging enabled...\n');
  
  try {
    // Call the Docker container's API
    const response = await axios.post('http://localhost:3000/create-landing', testData, {
      headers: {
        'x-webhook-secret': 'c0d4bba74684111b'
      },
      timeout: 120000 // 2 minute timeout
    });
    
    console.log('Response:', response.data);
    
    if (response.data.success) {
      console.log('✅ Form filled successfully');
      if (response.data.previewUrl) {
        console.log('Preview URL:', response.data.previewUrl);
      }
    } else {
      console.log('❌ Form filling failed');
    }
  } catch (error) {
    console.error('Error:', error.message);
    if (error.response) {
      console.error('Response data:', error.response.data);
    }
  }
}

testDebug();