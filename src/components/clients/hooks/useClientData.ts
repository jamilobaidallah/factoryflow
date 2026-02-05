import { useState, useEffect } from 'react';
import { doc, getDoc } from 'firebase/firestore';
import { firestore } from '@/firebase/config';
import { useUser } from '@/firebase/provider';
import { useToast } from '@/hooks/use-toast';
import { useRouter } from 'next/navigation';

export interface Client {
  id: string;
  name: string;
  phone: string;
  email: string;
  address: string;
  balance: number;
  createdAt: Date;
}

/**
 * Hook to load client data from Firestore
 * Handles loading state, error handling, and redirect if client not found
 */
export function useClientData(clientId: string) {
  const { user } = useUser();
  const { toast } = useToast();
  const router = useRouter();
  const [client, setClient] = useState<Client | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user || !clientId) {return;}

    const clientRef = doc(firestore, `users/${user.dataOwnerId}/clients`, clientId);
    getDoc(clientRef)
      .then((docSnap) => {
        if (docSnap.exists()) {
          const data = docSnap.data();
          setClient({
            id: docSnap.id,
            ...data,
            createdAt: data.createdAt?.toDate?.() || new Date(),
          } as Client);
        } else {
          toast({
            title: "خطأ",
            description: "العميل غير موجود",
            variant: "destructive",
          });
          router.push("/clients");
        }
        setLoading(false);
      })
      .catch((error) => {
        console.error("Error loading client:", error);
        toast({
          title: "خطأ",
          description: "حدث خطأ أثناء تحميل بيانات العميل",
          variant: "destructive",
        });
        setLoading(false);
      });
  }, [user, clientId, router, toast]);

  return { client, loading };
}
