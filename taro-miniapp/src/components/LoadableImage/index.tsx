import { View, Text, Image } from '@tarojs/components'
import { useEffect, useState } from 'react'
import styles from './index.module.scss'

interface LoadableImageProps {
  src?: string
  /** 容器尺寸需由父级通过 className 控制 */
  className?: string
  mode?: 'aspectFill' | 'aspectFit' | 'widthFix'
  /** 加载失败时展示的名称，便于识别是哪张图 */
  name?: string
  onClick?: () => void
}

/**
 * 图片加载增强壳：loading 骨架 → 加载失败降级占位 + 一键重试。
 * 解决弱网/链接过期导致的图片显示异常，统一各列表缩略图行为。
 */
export default function LoadableImage({ src, className, mode = 'aspectFill', name, onClick }: LoadableImageProps) {
  const [loaded, setLoaded] = useState(false)
  const [error, setError] = useState(false)
  const [tryNo, setTryNo] = useState(0)

  // src 变化（含外部刷新换新链接）后重置加载状态
  useEffect(() => {
    setLoaded(false)
    setError(false)
  }, [src])

  const handleLoad = () => {
    setLoaded(true)
    setError(false)
  }

  const handleError = () => {
    setLoaded(false)
    setError(true)
    console.error('[Image] 图片加载失败', (src || '(无地址)').slice(0, 120))
  }

  const retry = () => {
    setError(false)
    setLoaded(false)
    setTryNo((n) => n + 1)
  }

  return (
    <View className={className || styles.box} onClick={onClick}>
      {!error ? (
        <Image
          key={tryNo}
          className={styles.img}
          src={src || ''}
          mode={mode}
          onLoad={handleLoad}
          onError={handleError}
        />
      ) : null}

      {!error && !loaded ? (
        <View className={styles.loading}>
          <Text className={styles.loadingText}>图片加载中…</Text>
        </View>
      ) : null}

      {error ? (
        <View className={styles.error}>
          <Text className={styles.errorIcon}>🖼️</Text>
          <Text className={styles.errorText}>{name ? `${name}加载失败` : '图片加载失败'}</Text>
          <View className={styles.retryBtn} onClick={retry}>
            <Text className={styles.retryText}>点击重试</Text>
          </View>
        </View>
      ) : null}
    </View>
  )
}
