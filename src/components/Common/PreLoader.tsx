import React from 'react'
import BrandLoader from './BrandLoader'

/** Full-screen boot state, used before the shell is ready to paint. */
const PreLoader = () => {
  return (
    <div className="fixed left-0 top-0 z-[999999] flex h-screen w-screen items-center justify-center bg-white dark:bg-[#080808]">
      <BrandLoader variant="inline" />
    </div>
  )
}

export default PreLoader
