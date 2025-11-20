# Flashcard App

A competitive, user-friendly flashcard web app for English vocabulary review that balances scientific effectiveness (spaced repetition) with frictionless design.

## Features

### 🧠 Smart Study Engine
- **Spaced Repetition System (SRS)**: SM-2 algorithm for optimal review scheduling
- **Active Recall Grading**: 4 quality ratings (Again, Hard, Good, Easy)
- **Cloze Deletion**: Fill-in-the-blank cards for contextual learning
- **Reverse Cards**: Automatic generation of definition → word cards

### 🚀 Frictionless Input
- **Auto-Dictionary Lookup**: Free Dictionary API integration for definitions, phonetics, and part of speech
- **Contextual Sentences**: Datamuse API for real-world usage examples
- **AI-Powered Hints**: OpenAI integration for mnemonics and simplified explanations
- **Image Associations**: Unsplash API for visual learning aids

### 🎨 Rich Media & Audio
- **Text-to-Speech**: Multiple accent support (US, UK, Australian)
- **High-Quality Audio**: Web Speech API with OpenAI TTS fallback
- **Visual Learning**: Image integration for enhanced memory retention

### ⌨️ Power User Experience
- **Keyboard Shortcuts**: Full keyboard navigation for efficient studying
- **Dark Mode**: Eye-friendly interface for late-night sessions
- **Mobile Responsive**: PWA with touch gestures and offline support
- **Distraction-Free Mode**: Minimal interface for focused learning

### 📊 Gamification & Analytics
- **Study Streaks**: Motivational streak tracking with GitHub-style heatmaps
- **Progress Analytics**: Vocabulary size estimation and learning insights
- **Daily Goals**: Customizable study targets with achievement celebrations
- **Achievement System**: Milestone badges and progress tracking

### 📚 Content Library
- **Pre-made Decks**: Curated decks (TOEFL, Business English, Common Words)
- **Deck Sharing**: Share decks via simple URL links
- **Community Features**: Public deck gallery and user contributions

## Tech Stack

- **Frontend**: Next.js 14+ (App Router), TypeScript, Tailwind CSS
- **Backend**: Supabase (PostgreSQL, Auth, Storage)
- **UI Components**: Radix UI, shadcn/ui
- **State Management**: Zustand, React Context
- **APIs**: Free Dictionary, Datamuse, OpenAI, Unsplash
- **Deployment**: Docker, GitHub Actions, Vercel-ready

## Getting Started

### Prerequisites
- Node.js 20+
- npm or yarn
- Supabase account (for database and authentication)
- OpenAI API key (optional, for AI features)
- Unsplash API key (optional, for images)

### Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd flashcard-app
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment variables**
   ```bash
   cp .env.example .env.local
   # Edit .env.local with your API keys
   ```

4. **Set up Supabase**
   ```bash
   # Run the database migrations
   supabase db push
   ```

5. **Start development server**
   ```bash
   npm run dev
   ```

6. **Open your browser**
   Navigate to [http://localhost:3000](http://localhost:3000)

## Environment Variables

Create a `.env.local` file with the following variables:

```env
# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key

# OpenAI API (optional)
OPENAI_API_KEY=your_openai_api_key
OPENAI_BASE_URL=your_openai_base_url
OPENAI_MODEL=gpt-5-mini

# Unsplash API (optional)
UNSPLASH_ACCESS_KEY=your_unsplash_access_key

# App Configuration
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

## Project Structure

```
flashcard-app/
├── src/
│   ├── app/                    # Next.js App Router pages
│   │   ├── page.tsx           # Homepage
│   │   ├── auth/              # Authentication pages
│   │   ├── cards/             # Card management
│   │   └── study/             # Study session
│   ├── components/
│   │   └── ui/                # Reusable UI components
│   ├── lib/
│   │   ├── api/               # External API integrations
│   │   ├── supabase/          # Supabase client
│   │   ├── sm2.ts              # Spaced repetition algorithm
│   │   └── utils.ts            # Utility functions
│   └── types/                 # TypeScript type definitions
├── supabase/
│   └── migrations/             # Database migrations
├── public/                     # Static assets
├── docker/                     # Docker configuration
├── .github/workflows/           # GitHub Actions CI/CD
└── docs/                       # Documentation
```

## Available Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run start` - Start production server
- `npm run lint` - Run ESLint
- `npm run type-check` - Run TypeScript type checking

## Key Features Implementation

### SM-2 Algorithm
The SuperMemo 2 algorithm is implemented in [`src/lib/sm2.ts`](src/lib/sm2.ts):

- Calculates optimal review intervals
- Supports 4 quality ratings (0-5)
- Handles ease factor adjustments
- Determines card maturity (21+ days)

### API Integrations

#### Dictionary API
- Free Dictionary API for definitions and phonetics
- Automatic part-of-speech detection
- Multiple definitions and examples

#### AI Integration
- OpenAI GPT-5-mini for cost-effective AI features
- Mnemonic generation for memory aids
- "Explain like I'm 5" simplification
- Contextual sentence generation

#### Image Search
- Unsplash API for high-quality images
- Automatic image selection
- Fallback to text-only cards

### Study Interface
- Keyboard shortcuts for power users
- Touch gestures for mobile
- Audio pronunciation with multiple accents
- Real-time progress tracking
- Distraction-free mode option

## Development Workflow

1. **Feature Development**: Work on features in parallel branches
2. **Testing**: Comprehensive testing before merging
3. **Code Review**: Peer review for quality assurance
4. **Integration**: Test API integrations thoroughly
5. **Documentation**: Update docs for new features

## Deployment

### Docker Deployment
```bash
# Build Docker image
docker build -t flashcard-app .

# Run with Docker Compose
docker-compose -f docker-compose.prod.yml up -d
```

### Vercel Deployment
```bash
# Install Vercel CLI
npm i -g vercel

# Deploy to Vercel
vercel --prod
```

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Acknowledgments

- [Next.js](https://nextjs.org/) - React framework
- [Supabase](https://supabase.com/) - Backend as a service
- [Tailwind CSS](https://tailwindcss.com/) - CSS framework
- [Radix UI](https://www.radix-ui.com/) - UI components
- [Free Dictionary API](https://dictionaryapi.dev/) - Dictionary data
- [Datamuse](https://www.datamuse.com/) - Example sentences
- [OpenAI](https://openai.com/) - AI capabilities
- [Unsplash](https://unsplash.com/) - Image API

## Support

For support and questions:
- Create an issue on GitHub
- Check the [documentation](docs/)
- Review the [FAQ](docs/faq.md)

---

**Built with ❤️ for effective vocabulary learning**
