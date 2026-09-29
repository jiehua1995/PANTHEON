<script setup lang="ts">
import { pantheonData } from '../data'
import { navigate } from '../router'
</script>

<template>
  <section class="space-y-7 py-10 text-[1.02rem] leading-[2] soft">
    <h1 class="text-[2rem] tracking-[0.2em]">关于万神殿</h1>
    <p>
      这是一个神话原型驱动的人格叙事系统，不是临床心理测试，也不是人格诊断。它把
      {{ pantheonData.dimensions.length }} 个连续维度、{{ pantheonData.deities.length }} 个神格原型、{{
        pantheonData.questions.length
      }} 个情境题放在浏览器本地计算，输出你的神格谱系。
    </p>
    <p>
      所有答案与结果只存在这台设备的 localStorage 里，不上传服务器，不调用任何 AI 接口。相同答案与相同版本号永远得到完全相同的称号与结果。
    </p>
    <p class="muted">
      版本：test {{ pantheonData.metadata.versions.test }} · scoring
      {{ pantheonData.metadata.versions.scoring }} · deity
      {{ pantheonData.metadata.versions.deityDatabase }} · result
      {{ pantheonData.metadata.versions.result }}
    </p>
    <button class="btn" @click="navigate('')">返回首页</button>
  </section>
</template>
