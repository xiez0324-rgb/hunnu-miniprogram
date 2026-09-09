import { View, Text, ScrollView, RootPortal } from '@tarojs/components'
import classnames from 'classnames'
import { useState } from 'react'
import styles from './index.module.scss'

interface SelectFieldProps {
  label: string
  value: string | string[]
  placeholder: string
  options: string[]
  onChange: (v: string | string[]) => void
  required?: boolean
  multiple?: boolean
}

export default function SelectField({
  label,
  value,
  placeholder,
  options,
  onChange,
  required,
  multiple,
}: SelectFieldProps) {
  const [open, setOpen] = useState(false)

  const isSelected = (opt: string) =>
    multiple ? (value as string[]).includes(opt) : opt === value

  const displayText = multiple
    ? (value as string[]).join('、')
    : (value as string)

  const toggle = (opt: string) => {
    if (multiple) {
      const arr = value as string[]
      onChange(arr.includes(opt) ? arr.filter((x) => x !== opt) : [...arr, opt])
    } else {
      onChange(opt)
      setOpen(false)
    }
  }

  return (
    <View className={styles.field}>
      <Text className={styles.label}>
        {required ? <Text className={styles.required}>* </Text> : null}
        {label}
      </Text>

      <View
        className={classnames(styles.trigger, open && styles.triggerOpen)}
        onClick={() => setOpen((v) => !v)}
      >
        <Text className={displayText ? styles.value : styles.placeholder}>
          {displayText || placeholder}
        </Text>
        <Text className={classnames(styles.arrow, open && styles.arrowUp)}>▾</Text>
      </View>

      {open && (
        <RootPortal>
          <View className={styles.mask} onClick={() => setOpen(false)}>
            <View className={styles.panel} onClick={(e) => e.stopPropagation()}>
              <ScrollView scrollY className={styles.list}>
                {options.map((opt) => {
                  const selected = isSelected(opt)
                  return (
                    <View
                      key={opt}
                      className={classnames(styles.option, selected && styles.optionSelected)}
                      onClick={() => toggle(opt)}
                    >
                      <Text className={styles.optionText}>{opt}</Text>
                      {selected && <Text className={styles.check}>✓</Text>}
                    </View>
                  )
                })}
              </ScrollView>
              {multiple && (
                <View className={styles.confirm} onClick={() => setOpen(false)}>
                  <Text className={styles.confirmText}>确定</Text>
                </View>
              )}
            </View>
          </View>
        </RootPortal>
      )}
    </View>
  )
}
