# c-2a 文书独立终审

日期：2026-10-11。两名并行审阅者只读本轮文书与冻结源码边界，不实现机制、不改旧文件。

key交付审阅确认：ECDH proof、服务AuthorKeyBinding来源、注册签名、P3包/acceptance、不扩c-1 purpose、独立封装producer以及无秘密持久化边界一致。提出proof错误统一分类，已冻结403 DeviceUntrusted/CredentialMismatch，不将world ECDH失败冒称全局Auth device撤销。

clock/PG终审提出两个文书问题，均已修正并获只读复核通过：

1. 新nonce复取旧事实不能裸返回旧nonce receipt。HTTP六类P3 mutation统一SharedTransportReceipt<AuthorityProtocolResult<T>>；wrapper绑当前nonce、内层历史receipt原nonce/签名不变，原nonce重传原整个wrapper。新type/purpose/返回值与v3.19附录已同步。
2. c-2验收“注销”改为“会话logout”，不新增账号closure生产者；closure恒null保持。

其余clock durable floor、PG全局identity/uint64cursor/锁序、authority/Relay职责、最短retention、阶段前置未发现剩余实质矛盾。本证据是文书审阅，不是c-2代码/crypto/network/PG运行测试。
