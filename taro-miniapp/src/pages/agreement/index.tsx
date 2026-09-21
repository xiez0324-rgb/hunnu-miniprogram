import { View, Text } from '@tarojs/components'
import Taro from '@tarojs/taro'
import NavBar from '@/components/NavBar'
import styles from '../privacy/index.module.scss'

export default function AgreementPage() {
  return (
    <View className={styles.page}>
      <NavBar title="用户服务协议" onBack={() => Taro.navigateBack()} />

      <View className={styles.card}>
        <Text className={styles.title}>📜 用户服务协议</Text>

        <View className={styles.body}>
          <Text className={styles.paragraph}>
            欢迎使用「小小陪伴帮」。本协议是您与「小小陪伴帮」之间就使用本小程序服务所订立的协议。请您在使用前仔细阅读并充分理解本协议全部内容，特别是免责条款。您勾选同意或开始使用本服务，即表示您已阅读并同意本协议。
          </Text>

          <View className={styles.section}>
            <Text className={styles.sectionTitle}>一、服务内容</Text>
            <Text className={styles.paragraph}>
              1.1 本平台是面向家长与老师（在校学生等服务提供者）的信息服务工具。平台是信息的唯一收集者与发布者：由平台工作人员统一收集、录入、核验信息，并以平台名义统一发布与推荐，用户不直接对外发布任何信息。
            </Text>
            <Text className={styles.paragraph}>
              1.2 本平台不提供教学、照护等线下服务，不参与双方的服务安排与费用结算，也不代收任何费用。
            </Text>
          </View>

          <View className={styles.section}>
            <Text className={styles.sectionTitle}>二、账号与身份</Text>
            <Text className={styles.paragraph}>
              2.1 您可在同一微信账号下开通家长、老师两种身份，各自身份的信息独立保存。
            </Text>
            <Text className={styles.paragraph}>
              2.2 老师身份需提交学籍/学历等证明材料，经平台核验通过后方可展示认证标识。
            </Text>
          </View>

          <View className={styles.section}>
            <Text className={styles.sectionTitle}>三、信息收集与发布规范</Text>
            <Text className={styles.paragraph}>
              3.1 您无权直接发布信息。您向平台提交的文字、图片等内容，均由平台工作人员录入、核验后以平台名义统一发布；您应保证所提交的内容真实、准确、合法，不含有违法违规、虚假、侵权、骚扰、色情、暴力或其他不当信息。
            </Text>
            <Text className={styles.paragraph}>
              3.2 您提交的内容仅用于双方需求匹配，平台有权对内容进行核验；对违规或不当内容，平台有权不予发布、下架或删除，并保留追究责任的权利。
            </Text>
            <Text className={styles.paragraph}>
              3.3 平台内不设置点赞、评论、关注等社交功能，也不提供内容对外分享能力；平台发布的信息仅用于双方需求匹配与对接，不构成公开社区传播。
            </Text>
          </View>

          <View className={styles.section}>
            <Text className={styles.sectionTitle}>四、用户行为规范</Text>
            <Text className={styles.paragraph}>
              4.1 您不得利用本平台从事任何违反法律法规或侵犯他人合法权益的行为，不得冒用他人身份或提供虚假材料。
            </Text>
            <Text className={styles.paragraph}>
              4.2 因您违反上述规范给平台或第三方造成损失的，您应自行承担相应责任。
            </Text>
          </View>

          <View className={styles.section}>
            <Text className={styles.sectionTitle}>五、免责声明</Text>
            <Text className={styles.paragraph}>
              5.1 双方在对接过程中应自行核实对方身份、资质、能力及其他必要信息；因双方线下交易产生的争议与纠纷，平台在法律允许范围内不承担责任。
            </Text>
            <Text className={styles.paragraph}>
              5.2 家长应确保所填写的联系电话、服务地址等信息真实、准确、完整，因此产生的对接延误或纠纷由家长自行承担。
            </Text>
          </View>

          <View className={styles.section}>
            <Text className={styles.sectionTitle}>六、服务变更与终止</Text>
            <Text className={styles.paragraph}>
              6.1 平台可能根据法律法规或业务调整更新本协议或相关服务，更新后将在平台内公示；如您不同意更新内容，请停止使用本服务。
            </Text>
            <Text className={styles.paragraph}>
              6.2 如您违反本协议，平台有权视情况限制或终止向您提供服务。
            </Text>
          </View>

          <View className={styles.section}>
            <Text className={styles.sectionTitle}>七、其他</Text>
            <Text className={styles.paragraph}>
              7.1 本协议的订立、履行与解释均适用中华人民共和国法律。
            </Text>
            <Text className={styles.paragraph}>
              7.2 如对本协议有任何疑问、意见或投诉，请联系平台客服 Kiki。
            </Text>
          </View>
        </View>
      </View>
    </View>
  )
}
