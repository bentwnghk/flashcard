import Link from "next/link";

export default function Home() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background text-foreground">
      <main className="flex flex-col items-center justify-center text-center p-8">
        <div className="max-w-4xl">
          <h1 className="text-4xl font-bold tracking-tight mb-4">
            Flashcard App
          </h1>
          <p className="text-xl text-muted-foreground mb-8">
            Learn English vocabulary with scientifically-proven spaced repetition
          </p>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
            <div className="bg-card p-6 rounded-lg border">
              <h2 className="text-2xl font-semibold mb-4">Smart Study Engine</h2>
              <p className="text-muted-foreground mb-4">
                SM-2 spaced repetition algorithm schedules reviews based on how well you know each word
              </p>
              <ul className="text-left space-y-2">
                <li>✓ Active recall grading</li>
                <li>✓ Cloze deletion cards</li>
                <li>✓ Automatic reverse cards</li>
              </ul>
            </div>
            
            <div className="bg-card p-6 rounded-lg border">
              <h2 className="text-2xl font-semibold mb-4">Frictionless Design</h2>
              <p className="text-muted-foreground mb-4">
                Create cards instantly with auto-lookup from multiple sources
              </p>
              <ul className="text-left space-y-2">
                <li>✓ Dictionary integration</li>
                <li>✓ AI-powered hints</li>
                <li>✓ Image associations</li>
              </ul>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link
              href="/auth/signup"
              className="bg-primary text-primary-foreground hover:bg-primary/90 px-6 py-3 rounded-md font-medium transition-colors"
            >
              Get Started
            </Link>
            <Link
              href="/auth/login"
              className="bg-secondary text-secondary-foreground hover:bg-secondary/80 px-6 py-3 rounded-md font-medium transition-colors"
            >
              Sign In
            </Link>
          </div>
        </div>
      </main>
    </div>
  );
}
