import { isDemoMode } from '@/lib/demo';
import { djangoRequest } from './djangoAuth';

export type NewsletterPost = {
  id: string;
  title: string;
  body: string;
  created_at: string; // ISO
  updated_at: string | null;
  author: string | null;
  published: boolean;
  category: string; // category key
  category_name?: string;
};

export type NewsletterCategory = {
  id?: string; // Django uses UUID, but let's keep key as identifier
  key: string;
  label: string;
  hue: string;
};

const LS_KEY = 'newsletter_posts';
const FB_KEY = 'newsletter_fallback_reason';

function loadLocal(): NewsletterPost[] {
  try {
    return JSON.parse(localStorage.getItem(LS_KEY) || '[]') as NewsletterPost[];
  } catch {
    return [];
  }
}
function saveLocal(list: NewsletterPost[]) {
  try { localStorage.setItem(LS_KEY, JSON.stringify(list)); } catch {}
}
function purgeLocalIfProduction() {
  // Keep for demo mode only
}

const DEFAULT_CATEGORIES: NewsletterCategory[] = [
  { key: 'release_notes', label: 'Release Notes', hue: 'blue' },
  { key: 'design_refresh', label: 'Design Refresh', hue: 'sky' },
  { key: 'content_update', label: 'Content Update', hue: 'amber' },
  { key: 'website_launch', label: 'Website Launch', hue: 'emerald' },
  { key: 'performance', label: 'Performance', hue: 'red' },
  { key: 'maintenance', label: 'Maintenance', hue: 'zinc' },
];

export async function listNewsletterCategories(): Promise<NewsletterCategory[]> {
  if (isDemoMode()) {
    return DEFAULT_CATEGORIES;
  }
  try {
    const res = await djangoRequest('/newsletter/categories/');
    if (res.success) {
      const categories = (res.data || []) as any[];
      return categories.length ? categories : DEFAULT_CATEGORIES;
    }
    return DEFAULT_CATEGORIES;
  } catch {
    return DEFAULT_CATEGORIES;
  }
}

export async function listNewsletterPosts(limit = 20): Promise<NewsletterPost[]> {
  if (isDemoMode()) {
    const cur = loadLocal();
    if (!cur.length) {
      const now = Date.now();
      const mk = (minsAgo: number) => new Date(now - minsAgo * 60000).toISOString();
      const seed: NewsletterPost[] = [
        { id: 'NEWS-900003', title: 'Homepage Refresh Now Live', body: 'Our primary landing page has been updated with the new hero layout, improved typography scale, and refined call-to-action block. Let us know if you spot spacing issues on tablet breakpoints.', author: 'design@sams.demo', published: true, created_at: mk(90), updated_at: null, category: 'design_refresh' },
        { id: 'NEWS-900002', title: 'Pricing Page Performance Win', body: 'Lazy loading and responsive image sets cut LCP to 1.6s on the pricing page. Marketing assets were recompressed and the testimonials carousel now defers below-the-fold rendering.', author: 'webops@sams.demo', published: true, created_at: mk(240), updated_at: null, category: 'performance' },
        { id: 'NEWS-900001', title: 'New Resource Center Navigation', body: 'We rolled out a streamlined navigation for resources with audience tags and contextual breadcrumbs. Content owners should review featured cards before Friday.', author: 'content@sams.demo', published: true, created_at: mk(480), updated_at: null, category: 'content_update' },
      ];
      saveLocal(seed);
    }
    return loadLocal().filter(p => p.published).sort((a, b) => (a.created_at < b.created_at ? 1 : -1)).slice(0, limit);
  }
  
  try {
    const res = await djangoRequest('/newsletter/posts/?published=true');
    if (res.success) {
      return (res.data || []) as NewsletterPost[];
    }
    return [];
  } catch {
    return [];
  }
}

export async function listAllNewsletterPosts(limit = 200): Promise<NewsletterPost[]> {
  if (isDemoMode()) {
    const cur = loadLocal();
    if (!cur.length) {
      const now = Date.now();
      const mk = (minsAgo: number) => new Date(now - minsAgo * 60000).toISOString();
      const seed: NewsletterPost[] = [
        { id: 'NEWS-900003', title: 'Homepage Refresh Now Live', body: 'Our primary landing page has been updated with the new hero layout, improved typography scale, and refined call-to-action block. Let us know if you spot spacing issues on tablet breakpoints.', author: 'design@sams.demo', published: true, created_at: mk(90), updated_at: null, category: 'design_refresh' },
        { id: 'NEWS-900002', title: 'Pricing Page Performance Win', body: 'Lazy loading and responsive image sets cut LCP to 1.6s on the pricing page. Marketing assets were recompressed and the testimonials carousel now defers below-the-fold rendering.', author: 'webops@sams.demo', published: true, created_at: mk(240), updated_at: null, category: 'performance' },
        { id: 'NEWS-900001', title: 'New Resource Center Navigation', body: 'We rolled out a streamlined navigation for resources with audience tags and contextual breadcrumbs. Content owners should review featured cards before Friday.', author: 'content@sams.demo', published: true, created_at: mk(480), updated_at: null, category: 'content_update' },
      ];
      saveLocal(seed);
    }
    return loadLocal().sort((a, b) => (a.created_at < b.created_at ? 1 : -1)).slice(0, limit);
  }
  
  try {
    const res = await djangoRequest('/newsletter/posts/');
    if (res.success) {
      return (res.data || []) as NewsletterPost[];
    }
    return [];
  } catch {
    return [];
  }
}

export async function createNewsletterPost(input: { title: string; body: string; category?: string; published?: boolean; author?: string | null }): Promise<NewsletterPost> {
  if (isDemoMode()) {
    const newPost: NewsletterPost = {
      id: `NEWS-${Math.floor(Math.random() * 900000 + 100000)}`,
      title: input.title,
      body: input.body,
      published: input.published ?? true,
      author: input.author ?? null,
      created_at: new Date().toISOString(),
      updated_at: null,
      category: input.category || 'release_notes',
    };
    const list = loadLocal();
    saveLocal([newPost, ...list]);
    return newPost;
  }
  
  const res = await djangoRequest('/newsletter/posts/', {
    method: 'POST',
    body: JSON.stringify(input)
  });
  
  if (res.success) {
    // Also send email if needed (this would be handled by backend ideally)
    return res.data as NewsletterPost;
  }
  throw new Error(res.message || 'Failed to create post');
}

export async function updateNewsletterPost(id: string, patch: Partial<Pick<NewsletterPost, 'title' | 'body' | 'published' | 'category'>>): Promise<NewsletterPost> {
  if (isDemoMode()) {
    const list = loadLocal();
    const idx = list.findIndex(p => p.id === id);
    if (idx >= 0) {
      const next = { ...list[idx], ...patch, updated_at: new Date().toISOString() } as NewsletterPost;
      const copy = [...list];
      copy[idx] = next;
      saveLocal(copy);
      return next;
    }
    throw new Error('Not found');
  }
  
  const res = await djangoRequest(`/newsletter/posts/${id}/`, {
    method: 'PUT',
    body: JSON.stringify(patch)
  });
  
  if (res.success) {
    return res.data as NewsletterPost;
  }
  throw new Error(res.message || 'Failed to update post');
}

export async function deleteNewsletterPost(id: string): Promise<void> {
  if (isDemoMode()) {
    const list = loadLocal();
    saveLocal(list.filter(p => p.id !== id));
    return;
  }
  
  await djangoRequest(`/newsletter/posts/${id}/`, {
    method: 'DELETE'
  });
}
