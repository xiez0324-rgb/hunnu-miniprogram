import { View, Text } from '@tarojs/components'
import Taro from '@tarojs/taro'
import NavBar from '@/components/NavBar'
import styles from './index.module.scss'

export default function PrivacyPage() {
  return (
    <View className={styles.page}>
      <NavBar title="隐私与风险说明" onBack={() => Taro.navigateBack()} />

      <View className={styles.card}>
        <Text className={styles.title}>📄 用户信息采集与隐私保护声明</Text>

        <View className={styles.body}>
          <Text className={styles.paragraph}>
            欢迎使用「小小陪伴帮」。我们深知个人信息对您的重要性，并将依照相关法律法规，采取合理的安全保护措施，尽力保障您的个人信息安全可控。本声明旨在向您说明我们如何收集、使用、存储与保护您的个人信息，以及您享有的相应权利。请您在提交任何信息前，仔细阅读并充分理解本声明全部内容。
          </Text>

          <View className={styles.section}>
            <Text className={styles.sectionTitle}>一、信息收集范围</Text>
            <Text className={styles.paragraph}>
              1.1 老师端：为完成身份核验与信息展示，我们会收集您的姓名、学院、专业、可授课科目与时段、期望时薪、可服务区域、自我介绍，以及用于学籍/学历证明的学生证、学信网截图等证明材料。
            </Text>
            <Text className={styles.paragraph}>
              1.2 家长端：为完成需求发布与对接，我们会收集您的称呼、联系电话、上课地址（可能精确至小区及楼栋）及需求描述等信息。
            </Text>
            <Text className={styles.paragraph}>
              1.3 我们仅收集您主动填写或上传、且与提供服务相关的必要信息，不超出上述范围收集与服务无关的信息。其中「联系电话」为选填项：您可以先浏览或发布需求而不填写，平台仅会在需要与您对接时通过微信征询；我们不会在您首次使用时强制索取手机号等个人信息。
            </Text>
          </View>

          <View className={styles.section}>
            <Text className={styles.sectionTitle}>二、信息使用目的</Text>
            <Text className={styles.paragraph}>
              2.1 学籍/学历证明材料仅用于对老师身份与资质的核验，并在获得您明确授权后，以「已认证」标签等形式在平台范围内展示。
            </Text>
            <Text className={styles.paragraph}>
              2.2 联系方式（电话、微信号等）仅用于平台代理人与您对接沟通，不会在需求广场等公开页面展示。
            </Text>
            <Text className={styles.paragraph}>
              2.3 家长住址信息仅用于匹配老师判断通勤距离及线下授课安排，不会向无关第三方披露。
            </Text>
          </View>

          <View className={styles.section}>
            <Text className={styles.sectionTitle}>三、授权展示与撤回</Text>
            <Text className={styles.paragraph}>
              涉及学籍、学历等身份信息的公开展示，须经您明确授权。您可随时在个人中心撤回授权，撤回后我们将停止相关展示。
            </Text>
          </View>

          <View className={styles.section}>
            <Text className={styles.sectionTitle}>四、信息撮合免责声明</Text>
            <Text className={styles.paragraph}>
              4.1 本平台仅提供家教信息撮合服务，不提供教学服务、不代收课时费。老师与家长的授课安排、费用结算等均由双方线下自行商定。
            </Text>
            <Text className={styles.paragraph}>
              4.2 双方在对接过程中应自行核实与本次授课相关的资质、能力及其他必要信息。因双方线下交易产生的争议与纠纷，平台在法律允许范围内不承担责任。
            </Text>
          </View>

          <View className={styles.section}>
            <Text className={styles.sectionTitle}>五、家长信息准确性</Text>
            <Text className={styles.paragraph}>
              家长应确保所填写的联系电话、上课地址等信息真实、准确、完整。因家长误填、漏填或提供虚假信息导致的无法对接、延误或相关纠纷，由家长自行承担，平台在法律允许范围内不承担责任。
            </Text>
          </View>

          <View className={styles.section}>
            <Text className={styles.sectionTitle}>六、学生信息验证责任</Text>
            <Text className={styles.paragraph}>
              6.1 平台对学生/老师提交的学籍、学历等身份信息承担主要核实责任，并通过人工核验等方式进行审查。
            </Text>
            <Text className={styles.paragraph}>
              6.2 因平台核实疏忽，致使不实学籍/学历信息被展示并给他人造成损失的，平台将在过错范围内承担相应责任，并积极跟进处理。
            </Text>
          </View>

          <View className={styles.section}>
            <Text className={styles.sectionTitle}>七、信息安全与保密</Text>
            <Text className={styles.paragraph}>
              我们采取合理的技术与管理措施保护您的个人信息，防止未经授权的访问、泄露、篡改或丢失。除法律法规规定或经您授权同意外，我们不会向无关第三方提供您的个人信息。
            </Text>
          </View>

          <View className={styles.section}>
            <Text className={styles.sectionTitle}>八、其他</Text>
            <Text className={styles.paragraph}>
              8.1 如对本声明或个人信息保护有任何疑问、意见或投诉，请联系平台代理人 Kiki。
            </Text>
            <Text className={styles.paragraph}>
              8.2 我们可能根据法律法规或业务调整适时更新本声明，更新后将在平台内公示。
            </Text>
          </View>
        </View>
      </View>
    </View>
  )
}
