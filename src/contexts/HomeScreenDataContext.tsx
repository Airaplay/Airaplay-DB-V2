import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { fetchHomeScreenData } from '../lib/dataFetching';

interface HomeScreenData {
  trendingSongs: any[];
  newReleases: any[];
  mustWatchVideos: any[];
  loops: any[];
  trendingAlbums: any[];
  topArtists: any[];
  mixes: any[];
  trendingNearYou: any[];
  aiRecommended: any[];
  timestamp: number;
}

interface HomeScreenDataContextType {
  data: HomeScreenData | null;
  isLoading: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
}

const HomeScreenDataContext = createContext<HomeScreenDataContextType | undefined>(undefined);

export const HomeScreenDataProvider = ({ children }: { children: ReactNode }) => {
  const [data, setData] = useState<HomeScreenData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchData = async (forceRefresh = false) => {
    try {
      // Only show loading on very first load when we have no data
      const shouldShowLoading = !data;
      if (shouldShowLoading) {
        setIsLoading(true);
      }
      setError(null);

      // Add timeout to prevent hanging
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Data fetch timeout')), 5000)
      );

      const result = await Promise.race([
        fetchHomeScreenData(forceRefresh),
        timeoutPromise
      ]);

      setData(result as HomeScreenData);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to fetch home screen data'));
      console.error('Error fetching home screen data:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    // Fetch data but don't block rendering
    fetchData().catch(err => {
      console.error('Initial data fetch failed:', err);
    });
  }, []);

  const refetch = async () => {
    await fetchData(true);
  };

  return (
    <HomeScreenDataContext.Provider value={{ data, isLoading, error, refetch }}>
      {children}
    </HomeScreenDataContext.Provider>
  );
};

export const useHomeScreenData = () => {
  const context = useContext(HomeScreenDataContext);
  if (context === undefined) {
    throw new Error('useHomeScreenData must be used within a HomeScreenDataProvider');
  }
  return context;
};
