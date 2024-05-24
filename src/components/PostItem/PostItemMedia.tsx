import React from 'react'
import { convertToEmbedUrl } from '../../utils/contentConverter'

interface PostItemMediaProps {
  mediaType: string
  mediaUrl: string
  content: string
  openOverlay: () => void
  youtubeIFrameRef?: React.RefObject<HTMLIFrameElement>
}

const PostItemMedia: React.FC<PostItemMediaProps> = ({
  mediaType,
  mediaUrl,
  content,
  openOverlay,
  youtubeIFrameRef,
}) => {
  const isMobile = () => window.matchMedia('(max-width: 640px)').matches
  const embedUrl =
    mediaType === 'video-youtube' ? convertToEmbedUrl(mediaUrl) : mediaUrl

  return (
    <div>
      {mediaType === 'image' && (
        <img
          src={mediaUrl}
          alt="Post media"
          className={`w-full ${isMobile() ? 'h-full' : 'max-h-[500px]'} object-cover sm:rounded sm:border border-gray-200 dark:border-gray-700 cursor-pointer`}
          onClick={openOverlay}
        />
      )}
      {mediaType === 'video-file' && (
        <video
          src={mediaUrl}
          controls
          autoPlay
          muted
          playsInline
          className={`w-full ${isMobile() ? 'h-full' : 'max-h-[500px]'} object-cover sm:rounded sm:border border-gray-200 dark:border-gray-700 cursor-pointer`}
        />
      )}
      {mediaType === 'video-youtube' && (
        <iframe
          ref={youtubeIFrameRef}
          className="w-full aspect-video sm:rounded sm:border border-gray-200 dark:border-gray-700 cursor-pointer"
          title={content}
          src={`${embedUrl}?enablejsapi=1`}
          allow="autoplay; encrypted-media"
          allowFullScreen
        ></iframe>
      )}
    </div>
  )
}

export default PostItemMedia