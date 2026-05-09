/**
 * PostMediaGrid — Responsive media layout (1-4 images, video)
 */
import { useState } from 'react';
import { Play } from 'lucide-react';

export default function PostMediaGrid({ urls, postType }) {
  const count = urls.length;

  if (postType === 'video' || postType === 'short_video') {
    return (
      <div className="relative aspect-video bg-black">
        <video
          src={urls[0]}
          className="w-full h-full object-cover"
          controls
          preload="metadata"
          poster={urls[1]}
        />
      </div>
    );
  }

  if (count === 1) {
    return (
      <div className="max-h-96 overflow-hidden">
        <img src={urls[0]} alt="" className="w-full h-full object-cover" loading="lazy" />
      </div>
    );
  }

  if (count === 2) {
    return (
      <div className="grid grid-cols-2 gap-0.5">
        {urls.map((url, i) => (
          <img key={i} src={url} alt="" className="aspect-square object-cover w-full" loading="lazy" />
        ))}
      </div>
    );
  }

  if (count === 3) {
    return (
      <div className="grid grid-cols-2 gap-0.5">
        <img src={urls[0]} alt="" className="row-span-2 object-cover w-full h-full" loading="lazy" />
        <img src={urls[1]} alt="" className="aspect-square object-cover w-full" loading="lazy" />
        <img src={urls[2]} alt="" className="aspect-square object-cover w-full" loading="lazy" />
      </div>
    );
  }

  // 4+
  return (
    <div className="grid grid-cols-2 gap-0.5">
      {urls.slice(0, 4).map((url, i) => (
        <div key={i} className="relative aspect-square">
          <img src={url} alt="" className="w-full h-full object-cover" loading="lazy" />
          {i === 3 && count > 4 && (
            <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
              <span className="text-white text-xl font-bold">+{count - 4}</span>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}