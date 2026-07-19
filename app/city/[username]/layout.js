export async function generateMetadata({ params }) {
  const { username } = await params;
  return {
    title: `${username}'s Commit City`,
    description: `${username}'s GitHub as the New York skyline at night — one tower per project.`,
    openGraph: {
      title: `${username}'s Commit City`,
      description: "A night skyline built from GitHub repositories.",
      images: [`/api/og/${username}`],
    },
    twitter: {
      card: "summary_large_image",
      images: [`/api/og/${username}`],
    },
  };
}

export default function CityLayout({ children }) {
  return children;
}
