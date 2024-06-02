import React, { useState, useEffect } from 'react'
import { useParams } from 'react-router-dom'
import toast from 'react-hot-toast'
import FollowButton from '../components/common/FollowButton'
import { posts as mockPosts } from '../data/dummy-posts'
import { User } from '../models/user'
import { AiOutlineThunderbolt } from 'react-icons/ai'
import UserExternalLinks from '../components/User/UserExternalLinks'
import { nostrAddressForDisplay } from '../utils/addressConverter'
import { TextConverter } from '../components/common/TextConverter'
import TimelineStandard from '../components/Timeline/TimelineStandard'

const UserPage: React.FC = () => {
  const { userId } = useParams<{ userId: string }>()
  const [user, setUser] = useState<User | null>(null)
  const [isFollowing, setIsFollowing] = useState<boolean>(false)
  const userPosts = mockPosts.filter((post) => post.userId === userId)

  useEffect(() => {
    const fetchUserData = async () => {
      const mockUser = new User({
        npub: 'npub1v20e8yj9y7n58q5kfp0fahea9g4p3pmv2ufjgc6c9mcnugyeemyqu6s59g',
        pubkey:
          '629f93924527a7438296485e9edf3d2a2a18876c57132463582ef13e2099cec8',
        name: 'moti',
        nostrAddress: '_@motxx.pages.dev',
        image: 'https://randomuser.me/api/portraits/men/5.jpg',
        bio: 'This is a mock user bio.\nhttps://example.com#example',
        followersCount: 150,
        followingCount: 100,
        headerImage:
          'https://fastly.picsum.photos/id/227/600/200.jpg?hmac=iWKqkrS9xX7cgGWbiBCnAUzNtyCn8vpUBupjxwF3Lo8',
        links: {
          github: 'https://github.com/example',
          twitter: 'https://twitter.com/example',
          mastodon: 'https://mastodon.social/@example',
          telegram: 'https://t.me/example',
          bluesky: 'https://bsky.app/profile/example',
          pixiv: 'https://pixiv.net/users/example',
          skeb: 'https://skeb.jp/@example',
          instagram: 'https://instagram.com/example',
          website: 'https://example.com',
        },
      })
      setUser(mockUser)
    }

    fetchUserData()
  }, [userId])

  const toggleFollow = () => {
    setIsFollowing(!isFollowing)
    toast(
      `@${userId}さん${isFollowing ? 'のフォローを解除しました' : 'をフォローしました'}`,
      {
        position: 'bottom-center',
        duration: 2000,
        style: {
          borderRadius: '40px',
          background: '#1d4ed8',
          color: '#fff',
        },
      }
    )
    return true
  }

  if (!user) return <div>Loading...</div>

  return (
    <div className="flex flex-col items-center w-full">
      <div className="relative w-full">
        <img
          src={user.headerImage}
          alt="Header"
          className="w-full h-64 object-cover"
        />
        <div className="absolute inset-0 flex items-center justify-center sm:justify-start sm:items-start sm:top-32 sm:left-8">
          <img
            src={user.image}
            alt="User profile"
            className="w-40 h-40 rounded-full border-4 border-white dark:border-black"
          />
        </div>
      </div>
      <div className="flex flex-col items-start w-full px-6 pt-2 sm:pt-6">
        <div className="flex items-center justify-between pt-4 w-full">
          <h1 className="text-2xl font-bold">{user.name}</h1>
          <div className="flex items-center space-x-2 ml-auto">
            <UserExternalLinks links={user.links} />
            <AiOutlineThunderbolt className="text-3xl text-yellow-500" />
            <FollowButton
              isFollowing={isFollowing}
              toggleFollow={toggleFollow}
            />
          </div>
        </div>
        <div>
          <p className="text-gray-500">
            {user.nostrAddress
              ? nostrAddressForDisplay(user.nostrAddress)
              : user.npub}
          </p>
          <p className="mt-4 text-sm text-gray-700 dark:text-gray-300">
            <TextConverter text={user.bio} />
          </p>
          <div className="flex space-x-4">
            <div>
              <span className="font-bold">{user.followingCount}</span>{' '}
              フォロー中
            </div>
            <div>
              <span className="font-bold">{user.followersCount}</span>{' '}
              フォロワー
            </div>
          </div>
        </div>
        <div className="mt-8 w-full max-w-2xl mx-auto">
          <h2 className="text-lg font-bold mb-4">投稿</h2>
          <TimelineStandard
            posts={userPosts}
            onToggleFollow={() => {
              return true
            }}
          />
        </div>
      </div>
    </div>
  )
}

export default UserPage
