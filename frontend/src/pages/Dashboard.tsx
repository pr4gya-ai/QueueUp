import { ActivityIcon, SendIcon, TrendingUpIcon } from 'lucide-react';
import { useEffect, useState } from 'react'
import toast from 'react-hot-toast';
import api, { getErrorMessage } from '../api/axios';
import { useAuth } from '../context/authContext';
import { formatDateTime } from '../utils/schedule';
import type { Account, Activity, Post } from '../types';

const ACTIVITY_LABELS: Record<Activity['actionType'], string> = {
  POST_PUBLISHED: 'Published',
  AI_REPLY: 'AI reply',
}

const greeting = () => {
  const hour = new Date().getHours()
  if (hour < 12) return 'Good morning'
  if (hour < 18) return 'Good afternoon'
  return 'Good evening'
}

const Dashboard = () => {
  const { user } = useAuth()
  const [stats, setStats] = useState({
    scheduled: 0, published: 0, failed: 0, connectedAccounts: 0, nextScheduled: ''
  })
  const [activity, setActivity] = useState<Activity[]>([]);

  useEffect(() => {
    const fetchDashboardStats = async () => {
      try {
        const [postsRes, accountsRes, activityRes] = await Promise.all([
          api.get<Post[]>("/api/post"),
          api.get<Account[]>("/api/accounts"),
          api.get<Activity[]>("/api/activity"),
        ])

        const posts = postsRes.data;
        const upcoming = posts
          .filter((post) => post.status === 'scheduled')
          .sort((a, b) => new Date(a.scheduledFor).getTime() - new Date(b.scheduledFor).getTime());

        setStats({
          scheduled: upcoming.length,
          published: posts.filter((post) => post.status === 'published').length,
          failed: posts.filter((post) => post.status === 'failed').length,
          connectedAccounts: accountsRes.data.filter((acc) => acc.status === 'connected').length,
          nextScheduled: upcoming[0] ? formatDateTime(upcoming[0].scheduledFor) : '',
        });
        setActivity(activityRes.data);
      }
      catch (error) {
        toast.error(getErrorMessage(error, 'Failed to load dashboard'));
      }
    };
    fetchDashboardStats();
  }, [])

  const statCards = [
    {
      label: 'Scheduled Posts',
      value: stats.scheduled,
      trend: stats.nextScheduled ? `Next: ${stats.nextScheduled}` : 'Nothing queued',
    },
    {
      label: 'Published Posts',
      value: stats.published,
      trend: 'All time'
    },
    {
      label: 'Failed Posts',
      value: stats.failed,
      trend: stats.failed > 0 ? 'Needs attention' : 'All good'
    },
    {
      label: 'Connected Accounts',
      value: stats.connectedAccounts,
      trend: 'Active'
    }
  ]

  const firstName = user?.name?.split(' ')[0]

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-2xl text-slate-900">{greeting()}{firstName ? `, ${firstName}` : ''}! 👋🏼</h2>
        <p className="text-slate-500 text-sm mt-0.5">
          Here's what's happening with your social media accounts today.
        </p>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
        {statCards.map((card) => (
          <div key={card.label} className="bg-white hover:bg-red-50 relative border border-slate-200 rounded-2xl p-5 hover:border-red-200 transition-all">
            <div className="flex items-center justify-between mb-4">
              <div className="text-3xl font-medium text-slate-800 tabular-nums">{card.value}</div>
              <div className="text-xs absolute right-4 top-4 text-red-500 flex items-center gap-1">
                <TrendingUpIcon className="size-3" />
                {card.trend}
              </div>
            </div>
            <p className="text-sm text-slate-500 mt-1">{card.label}</p>
          </div>
        ))}
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
        <div className="flex items-center justify-between px-6 py-5 border-b border-slate-100">
          <h2 className="text-slate-900">Recent Activity</h2>
          <span className="text-sm text-slate-400">
            {activity.length} events
          </span>
        </div>

        {activity.length === 0 ? (
          <div className="flex flex-col items-center py-16 px-6">
            <div className="size-12 bg-slate-100 rounded-xl flex items-center justify-center mb-3 mx-auto">
              <ActivityIcon className="size-6 text-slate-400" />
            </div>

            <p className='text-slate-500'>No recent activity to display</p>
            <p className='text-slate-400 text-sm mt-1'>
              Connect accounts and schedule posts to see activity here.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-slate-50">
            {activity.map((activityItem) => (
              <div key={activityItem._id} className="flex items-start gap-4 px-6 py-4
                hover:bg-slate-50/50 transition-colors">
                <div className="size-9 rounded-xl flex items-center justify-center shrink-0 mt-0.5 bg-zinc-100 text-zinc-600">
                  <SendIcon className="size-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <span className='text-xs px-2 py-0.5 rounded-full bg-zinc-100 text-zinc-600'>
                      {ACTIVITY_LABELS[activityItem.actionType] ?? activityItem.actionType}
                    </span>
                    <span className='text-xs text-slate-400 shrink-0'>{new Date(activityItem.createdAt).toLocaleDateString()}</span>
                  </div>
                  <p className="text-sm text-slate-600">{activityItem.description}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

    </div>
  )
}

export default Dashboard
