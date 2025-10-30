# Architecture API - Night Batch UI

## 🏗️ Architecture

Cette architecture est basée sur les principes suivants :
- **DRY (Don't Repeat Yourself)** : Pas de répétition, tout est générique et réutilisable
- **Déclaratif** : Configuration plutôt qu'implémentation
- **Type-safe** : TypeScript + Zod pour une validation complète
- **Feature-based** : Organisation par fonctionnalités métier

## 📁 Structure

```
ui/src/
├── lib/api/                      # Infrastructure API générique
│   ├── client.ts                 # Client HTTP avec validation Zod
│   ├── query-factory.ts          # Factory pour créer des hooks React Query
│   ├── types.ts                  # Types communs
│   └── index.ts
│
└── features/jobs/                # Feature Jobs
    ├── api/
    │   ├── schemas.ts            # Schémas Zod (types + validation)
    │   ├── service.ts            # Service API déclaratif
    │   ├── queries.ts            # Hooks React Query
    │   └── index.ts
    ├── components/
    │   ├── JobsList.tsx          # Composant liste
    │   ├── JobDetail.tsx         # Composant détail
    │   └── index.ts
    └── index.ts
```

## 🚀 Utilisation

### 1. Configuration

Créer un fichier `.env` :
```bash
VITE_API_BASE_URL=http://localhost:8080
```

### 2. Utilisation dans un composant

#### Exemple simple : Liste des jobs

```tsx
import { useJobs, useTriggerJob } from '@/features/jobs';

function JobsPage() {
  // Query avec auto-refresh et cache
  const { data, isLoading, error } = useJobs(undefined, {
    refetchInterval: 5000,
    staleTime: 3000,
  });

  // Mutation
  const triggerJob = useTriggerJob({
    onSuccess: (jobId) => console.log('Job créé:', jobId),
  });

  if (isLoading) return <div>Loading...</div>;
  if (error) return <div>Error: {error.detail}</div>;

  return (
    <div>
      <button onClick={() => triggerJob.mutate()}>
        Trigger Job
      </button>
      {data.jobs.map(job => (
        <div key={job.job_id}>{job.job_id}</div>
      ))}
    </div>
  );
}
```

#### Exemple avancé : Détail avec retry

```tsx
import { useJobFlat, useRetryTask } from '@/features/jobs';

function JobDetailPage({ jobId }: { jobId: string }) {
  const { data } = useJobFlat(jobId, {
    refetchInterval: 2000,
  });

  const retryTask = useRetryTask({
    onSuccess: () => console.log('Retry déclenché'),
  });

  const handleRetry = (taskId: string) => {
    retryTask.mutate({
      jobId,
      request: {
        task_id: taskId,
        reset_downstream: true,
        max_concurrency: 4,
      },
    });
  };

  return <div>...</div>;
}
```

## 🔧 Créer une nouvelle feature API

### Étape 1 : Créer les schémas Zod

```typescript
// features/mon-feature/api/schemas.ts
import { z } from 'zod';

export const MyEntitySchema = z.object({
  id: z.string(),
  name: z.string(),
  status: z.enum(['active', 'inactive']),
});
export type MyEntity = z.infer<typeof MyEntitySchema>;

export const MyEntityListSchema = z.array(MyEntitySchema);
export type MyEntityList = z.infer<typeof MyEntityListSchema>;
```

### Étape 2 : Créer le service

```typescript
// features/mon-feature/api/service.ts
import { apiClient } from '@/lib/api/client';
import { MyEntitySchema, MyEntityListSchema } from './schemas';

export const myFeatureService = {
  getAll: () =>
    apiClient.get('/my-entities', MyEntityListSchema),

  getOne: (id: string) =>
    apiClient.get(`/my-entities/${id}`, MyEntitySchema),

  create: (data: CreateRequest) =>
    apiClient.post('/my-entities', MyEntitySchema, data),
} as const;
```

### Étape 3 : Créer les hooks React Query

```typescript
// features/mon-feature/api/queries.ts
import { QueryFactory } from '@/lib/api/query-factory';
import { MyEntityListSchema, MyEntitySchema } from './schemas';

// Query keys
export const myFeatureKeys = {
  all: ['my-feature'] as const,
  lists: () => [...myFeatureKeys.all, 'list'] as const,
  detail: (id: string) => [...myFeatureKeys.all, id] as const,
};

// Query hook
export const useMyEntities = QueryFactory.createQuery({
  queryKey: myFeatureKeys.lists(),
  endpoint: '/my-entities',
  schema: MyEntityListSchema,
});

// Mutation hook
export const useCreateEntity = QueryFactory.createMutation({
  endpoint: '/my-entities',
  schema: MyEntitySchema,
  invalidateKeys: [myFeatureKeys.lists()],
});
```

### Étape 4 : Utiliser dans un composant

```tsx
import { useMyEntities, useCreateEntity } from './api';

function MyComponent() {
  const { data, isLoading } = useMyEntities();
  const createEntity = useCreateEntity();

  // Typé automatiquement grâce à Zod !
  return <div>{data?.map(entity => entity.name)}</div>;
}
```

## ✨ Avantages de cette architecture

### 1. **Zéro répétition**
- Le client HTTP est générique
- La factory crée automatiquement les hooks
- Les types sont inférés depuis Zod

### 2. **Type-safety complet**
```typescript
// ✅ TypeScript sait tout !
const { data } = useJobs();
data.jobs[0].job_id // ✓ string
data.jobs[0].status // ✓ "scheduled" | "running" | ...
data.jobs[0].unknown // ✗ Erreur TypeScript
```

### 3. **Validation automatique**
```typescript
// Si l'API renvoie des données incorrectes, Zod rejette
const { data } = useJobs();
// Garantit que data correspond EXACTEMENT au schéma
```

### 4. **Déclaratif**
```typescript
// Pas de code boilerplate, juste de la config
export const useJobs = QueryFactory.createQuery({
  queryKey: jobsKeys.lists(),
  endpoint: '/jobs',
  schema: AllJobsResponseSchema,
});
```

### 5. **Cache et refetch automatiques**
```typescript
// React Query gère tout automatiquement
const { data } = useJobs(undefined, {
  refetchInterval: 5000,  // Auto-refresh
  staleTime: 3000,        // Cache
  retry: 3,               // Retry automatique
});
```

### 6. **Invalidation automatique**
```typescript
// Quand on créé un job, la liste est automatiquement rafraîchie
export const useTriggerJob = QueryFactory.createMutation({
  endpoint: '/jobs',
  schema: TriggerJobResponseSchema,
  invalidateKeys: [jobsKeys.lists()], // ✨ Magie !
});
```

## 🎯 Bonnes pratiques

### 1. Organisation par feature
```
features/
├── jobs/
├── runs/
└── workflows/
```

### 2. Schémas Zod co-localisés
Toujours définir les schémas Zod à côté du code qui les utilise.

### 3. Query keys structurés
```typescript
export const jobsKeys = {
  all: ['jobs'] as const,
  lists: () => [...jobsKeys.all, 'list'] as const,
  detail: (id: string) => [...jobsKeys.details(), id] as const,
  detailFlat: (id: string) => [...jobsKeys.detail(id), 'flat'] as const,
};
```

### 4. Invalidation précise
```typescript
// ✓ Bon : invalide seulement ce qui est nécessaire
invalidateKeys: [jobsKeys.lists()]

// ✗ Mauvais : invalide tout
invalidateKeys: [jobsKeys.all]
```

## 📦 Dépendances requises

Déjà installées dans `package.json` :
- `@tanstack/react-query` : Gestion d'état serveur
- `zod` : Validation et types
- TypeScript : Type-safety

## 🎨 Exemples complets

Voir les composants d'exemple :
- `features/jobs/components/JobsList.tsx` : Liste avec trigger
- `features/jobs/components/JobDetail.tsx` : Détail avec retry

## 🔄 Migration d'une feature existante

1. Créer les schémas Zod depuis les types existants
2. Remplacer les appels fetch par le service
3. Remplacer useState/useEffect par les hooks React Query
4. Profit ! 🎉

## 📚 Ressources

- [React Query Docs](https://tanstack.com/query/latest)
- [Zod Docs](https://zod.dev)
- [TypeScript Docs](https://www.typescriptlang.org)
