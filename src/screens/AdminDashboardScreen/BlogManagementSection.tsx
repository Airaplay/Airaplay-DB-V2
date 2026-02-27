import { useState, useEffect } from 'react';
import { Plus, Pencil, Trash2, Loader2 } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { LoadingLogo } from '../../components/LoadingLogo';

interface BlogPost {
  id: string;
  slug: string;
  title: string;
  excerpt: string | null;
  content: string;
  cover_image_url: string | null;
  faq: Array<{ question: string; answer: string }> | null;
  category: string | null;
  tags: string[] | null;
  is_published: boolean;
  published_at: string | null;
  created_at: string;
  updated_at: string | null;
}

const defaultForm = {
  title: '',
  slug: '',
  excerpt: '',
  content: '',
  cover_image_url: '',
  category: '',
  tags: '',
  is_published: false,
  published_at: '',
  faqJson: '[]'
};

export const BlogManagementSection = (): JSX.Element => {
  const [posts, setPosts] = useState<BlogPost[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [editingPost, setEditingPost] = useState<BlogPost | null>(null);
  const [formData, setFormData] = useState(defaultForm);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showForm, setShowForm] = useState(false);

  const fetchPosts = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const { data, error: fetchError } = await supabase
        .from('blog_posts')
        .select('*')
        .order('created_at', { ascending: false });
      if (fetchError) throw fetchError;
      setPosts((data as BlogPost[]) || []);
    } catch (err) {
      console.error('Error fetching blog posts:', err);
      setError(err instanceof Error ? err.message : 'Failed to load blog posts');
      setPosts([]);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchPosts();
  }, []);

  useEffect(() => {
    if (editingPost) {
      setFormData({
        title: editingPost.title,
        slug: editingPost.slug,
        excerpt: editingPost.excerpt || '',
        content: editingPost.content || '',
        cover_image_url: editingPost.cover_image_url || '',
        category: editingPost.category || '',
        tags: Array.isArray(editingPost.tags) ? editingPost.tags.join(', ') : '',
        is_published: !!editingPost.is_published,
        published_at: editingPost.published_at ? editingPost.published_at.slice(0, 16) : '',
        faqJson: editingPost.faq && editingPost.faq.length > 0 ? JSON.stringify(editingPost.faq, null, 2) : '[]'
      });
      setShowForm(true);
    } else if (!showForm) {
      setFormData(defaultForm);
    }
  }, [editingPost]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    const checked = (e.target as HTMLInputElement).checked;
    setFormData((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
    if (name === 'title' && !editingPost) {
      const slug = value
        .toLowerCase()
        .replace(/[^a-z0-9\s-]/g, '')
        .replace(/\s+/g, '-')
        .replace(/-+/g, '-')
        .replace(/^-|-$/g, '');
      setFormData((prev) => ({ ...prev, slug }));
    }
  };

  const parseFaq = (): Array<{ question: string; answer: string }> => {
    try {
      const parsed = JSON.parse(formData.faqJson || '[]');
      return Array.isArray(parsed)
        ? parsed
            .filter((item: any) => item && typeof item.question === 'string' && typeof item.answer === 'string')
            .map((item: any) => ({ question: item.question.trim(), answer: item.answer.trim() }))
        : [];
    } catch {
      return [];
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    if (!formData.title.trim() || !formData.slug.trim()) {
      setError('Title and slug are required');
      return;
    }
    setIsSubmitting(true);
    try {
      const payload = {
        title: formData.title.trim(),
        slug: formData.slug.trim().toLowerCase(),
        excerpt: formData.excerpt.trim() || null,
        content: formData.content.trim() || '',
        cover_image_url: formData.cover_image_url.trim() || null,
        category: formData.category.trim() || null,
        tags: formData.tags
          .split(',')
          .map((t) => t.trim())
          .filter(Boolean),
        is_published: formData.is_published,
        published_at: formData.published_at ? new Date(formData.published_at).toISOString() : null,
        faq: parseFaq(),
        updated_at: new Date().toISOString()
      };

      if (editingPost) {
        const { error: updateError } = await supabase.from('blog_posts').update(payload).eq('id', editingPost.id);
        if (updateError) throw updateError;
        setSuccess('Post updated successfully');
      } else {
        const { error: insertError } = await supabase.from('blog_posts').insert({ ...payload, created_at: new Date().toISOString() });
        if (insertError) throw insertError;
        setSuccess('Post created successfully');
      }
      setEditingPost(null);
      setFormData(defaultForm);
      setShowForm(false);
      await fetchPosts();
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      console.error('Error saving post:', err);
      setError(err instanceof Error ? err.message : 'Failed to save post');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this post? This cannot be undone.')) return;
    try {
      const { error: deleteError } = await supabase.from('blog_posts').delete().eq('id', id);
      if (deleteError) throw deleteError;
      setSuccess('Post deleted');
      if (editingPost?.id === id) {
        setEditingPost(null);
        setShowForm(false);
      }
      await fetchPosts();
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      console.error('Error deleting post:', err);
      setError(err instanceof Error ? err.message : 'Failed to delete post');
    }
  };

  return (
    <div className="p-6 bg-white rounded-lg shadow">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-bold text-gray-900">Blog</h2>
        <button
          type="button"
          onClick={() => {
            setEditingPost(null);
            setFormData(defaultForm);
            setShowForm(!showForm);
          }}
          className="flex items-center gap-2 px-4 py-2 bg-[#309605] text-white rounded-lg hover:bg-[#3ba208] transition-colors"
        >
          <Plus className="w-4 h-4" />
          {showForm ? 'Cancel' : 'Add post'}
        </button>
      </div>

      {(error || success) && (
        <div
          className={`mb-4 p-3 rounded-lg ${error ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}
        >
          {error || success}
        </div>
      )}

      {showForm && (
        <form onSubmit={handleSubmit} className="mb-8 p-4 border border-gray-200 rounded-lg space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Title *</label>
              <input
                type="text"
                name="title"
                value={formData.title}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                placeholder="Post title"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Slug * (URL: /blog/slug)</label>
              <input
                type="text"
                name="slug"
                value={formData.slug}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                placeholder="post-slug"
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Excerpt</label>
            <textarea
              name="excerpt"
              value={formData.excerpt}
              onChange={handleChange}
              rows={2}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg"
              placeholder="Short summary for SEO and cards"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Content (HTML)</label>
            <textarea
              name="content"
              value={formData.content}
              onChange={handleChange}
              rows={10}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg font-mono text-sm"
              placeholder="<p>...</p> Use &lt;h2&gt; and &lt;h3&gt; for TOC. Internal links: &lt;a href=&quot;artist:USER_ID&quot;&gt;Artist&lt;/a&gt; or &lt;a href=&quot;song:SONG_ID&quot;&gt;Song&lt;/a&gt;"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Cover image URL</label>
            <input
              type="url"
              name="cover_image_url"
              value={formData.cover_image_url}
              onChange={handleChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg"
              placeholder="https://..."
            />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
              <input
                type="text"
                name="category"
                value={formData.category}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                placeholder="e.g. News"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Tags (comma-separated)</label>
              <input
                type="text"
                name="tags"
                value={formData.tags}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                placeholder="music, artist, tips"
              />
            </div>
          </div>
          <div className="flex flex-wrap gap-4 items-center">
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                name="is_published"
                checked={formData.is_published}
                onChange={handleChange}
                className="rounded border-gray-300"
              />
              <span className="text-sm text-gray-700">Published</span>
            </label>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Published at (optional)</label>
              <input
                type="datetime-local"
                name="published_at"
                value={formData.published_at}
                onChange={handleChange}
                className="px-3 py-2 border border-gray-300 rounded-lg"
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">FAQ (JSON array for schema)</label>
            <textarea
              name="faqJson"
              value={formData.faqJson}
              onChange={handleChange}
              rows={4}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg font-mono text-sm"
              placeholder='[{"question":"...","answer":"..."}]'
            />
          </div>
          <button
            type="submit"
            disabled={isSubmitting}
            className="flex items-center gap-2 px-4 py-2 bg-[#309605] text-white rounded-lg hover:bg-[#3ba208] disabled:opacity-50"
          >
            {isSubmitting && <Loader2 className="w-4 h-4 animate-spin" />}
            {editingPost ? 'Update post' : 'Create post'}
          </button>
        </form>
      )}

      {isLoading ? (
        <div className="flex items-center gap-3 text-gray-600">
          <LoadingLogo variant="pulse" size={32} />
          <span>Loading posts...</span>
        </div>
      ) : posts.length === 0 ? (
        <p className="text-gray-500">No blog posts yet. Add one above.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full border border-gray-200 rounded-lg">
            <thead className="bg-gray-50">
              <tr>
                <th className="text-left p-3 text-sm font-semibold text-gray-700">Title</th>
                <th className="text-left p-3 text-sm font-semibold text-gray-700">Slug</th>
                <th className="text-left p-3 text-sm font-semibold text-gray-700">Status</th>
                <th className="text-left p-3 text-sm font-semibold text-gray-700">Updated</th>
                <th className="p-3 text-sm font-semibold text-gray-700">Actions</th>
              </tr>
            </thead>
            <tbody>
              {posts.map((post) => (
                <tr key={post.id} className="border-t border-gray-200 hover:bg-gray-50">
                  <td className="p-3 text-gray-900">{post.title}</td>
                  <td className="p-3 text-gray-600 font-mono text-sm">/blog/{post.slug}</td>
                  <td className="p-3">
                    <span className={post.is_published ? 'text-green-600' : 'text-gray-500'}>
                      {post.is_published ? 'Published' : 'Draft'}
                    </span>
                  </td>
                  <td className="p-3 text-gray-500 text-sm">{post.updated_at ? new Date(post.updated_at).toLocaleDateString() : '—'}</td>
                  <td className="p-3">
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => setEditingPost(post)}
                        className="p-2 text-gray-600 hover:bg-gray-200 rounded-lg"
                        aria-label="Edit"
                      >
                        <Pencil className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDelete(post.id)}
                        className="p-2 text-red-600 hover:bg-red-50 rounded-lg"
                        aria-label="Delete"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};
