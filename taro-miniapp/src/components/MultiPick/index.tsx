import { View, Text } from '@tarojs/components'
import { useState } from 'react'
import Chip from '@/components/Chip'
import styles from './index.module.scss'

interface MultiPickProps {
  label: string
  options: string[]
  value?: string[]
  onChange?: (v: string[]) => void
}

export default function MultiPick({ label, options, value, onChange }: MultiPickProps) {
  const [internal, setInternal] = useState<string[]>([options[0]!])
  const picked = value ?? internal

  const toggle = (option: string) => {
    const next = picked.includes(option)
      ? picked.filter((x) => x !== option)
      : [...picked, option]
    if (onChange) onChange(next)
    else setInternal(next)
  }

  return (
    <View className={styles.wrap}>
      <Text className={styles.label}>{label}</Text>
      <View className={styles.chips}>
        {options.map((option) => (
          <Chip key={option} active={picked.includes(option)} onClick={() => toggle(option)}>
            {option}
          </Chip>
        ))}
      </View>
    </View>
  )
}
