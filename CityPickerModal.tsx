import { Modal, Row, Col, message } from 'antd'
import _ from 'lodash'
import React, { useState, useEffect } from 'react'

import { region, allProvinceName } from 'shared/constants/index'

import PlaceCell from './PlaceCell'
import './style.scss'

// TODO: 底部footer的计数，onOk事件抛出的回参（等后端技术评审需要啥数据格式）
// 组件传进来的source需按如下格式处理
const formatChangeRegions = (regions, region, checked) =>
  regions.map(v => ({
    ...v,
    active: v.label === region.label,
    indeterminate: v.label === region.label ? false : v.indeterminate,
    checked: v.label === region.label ? checked : v.checked,
    children: v.children.map((p, pi) => ({
      ...p,
      checked: v.label === region.label ? checked : p.checked,
      indeterminate: v.label === region.label ? false : p.indeterminate,
      active: pi === 0,
      children: p.children.map(city => ({
        ...city,
        checked: v.label === region.label ? checked : city.checked,
      })),
    })),
  }))

// 计算地区一栏checkbox的中间态 （市区一栏的特殊，下面有另外的实现）
const getRegionIndeterminate = (v, province, checked) => {
  const checkedProvince = v.children.map(p => ({
    ...p,
    checked: p.label === province.label ? checked : p.checked,
  }))
  const isAllChecked =
    checkedProvince.length && checkedProvince.every(v => v.checked)
  return {
    isAllChecked,
    isIndeterminate: !isAllChecked && checkedProvince.some(v => v.checked),
  }
}
interface Props {
  visible: boolean
  rawAllData: any[]
  pickedData: any[]
  deleteRowData?: any[]
  editCityIndex: number | null
  editAddressCodes: any[]
  onCancel(): void
  onOk(arg, arg1, arg2): void
}
const ChooseCityModal: React.FC<Props> = props => {
  const {
    visible,
    rawAllData,
    deleteRowData,
    editCityIndex = null,
    editAddressCodes = [],
    pickedData = [], // [{names: nameStr, value: codes,}]形式
    onCancel,
    onOk,
  } = props
  const [data, setData] = useState([[], [], []])
  const [outPutCodes, setOutPutCodes] = useState([])
  const [outPutNames, setOutPutNames] = useState([])
  const [regions, provinces, cities] = data
  const provinceChecked = provinces.length && provinces.every(v => v.checked)
  const provinceDisabled = provinces.length && provinces.some(v => v.disabled)
  const provinceIndeterminate =
    !provinceChecked &&
    (provinces.some(v => v.checked) || provinces.some(v => v.indeterminate))
  const citiesChecked = cities.length && cities.every(v => v.checked)
  const citiesDisabled = cities.length && cities.some(v => v.disabled)
  const citiesIndeterminate = !citiesChecked && cities.some(v => v.checked)
  useEffect(() => {
    if (deleteRowData.length > 0) {
      const { names } = deleteRowData[0]
      const { value } = deleteRowData[0]
      setOutPutCodes(outPutCodes.filter(item => !value.includes(item)))
      setOutPutNames(
        outPutNames.filter(item => !names.split(',').includes(item)),
      )
    }
  }, [deleteRowData])
  useEffect(() => {
    setOutPutCodes(editAddressCodes)
    if (_.isNumber(editCityIndex)) {
      if (pickedData[editCityIndex].names.includes('全国')) {
        return setOutPutNames(allProvinceName)
      }
      return setOutPutNames(pickedData[editCityIndex].names.split(','))
    }
    setOutPutNames([])
  }, [editAddressCodes])
  useEffect(() => {
    // 将RawData转为格式data，处理树状数据
    // 如果编辑的话怎么办？进来有一份code列表，需要进行校验
    const pickedCodes = _.flatten(pickedData.map(item => item.value)) // 得到所有选中的codes
    const citysData = rawAllData.reduce((arr, rawCur) => {
      // children1为市列表， children2为小区列表
      const children1 = rawCur.children.map(item => {
        const children2 = []
        if (item.children instanceof Array) {
          for (let i = 0; i < item.children.length; i++) {
            children2.push({
              label: item.children[i].name,
              code: item.children[i].code,
              indeterminate: false, // 这边是chekcbox的横线
              checked: false,
              disabled: false,
              active: false,
              count: 0,
            })
          }
        }
        return {
          label: item.name,
          code: item.code,
          indeterminate: false,
          checked:
            pickedCodes.includes(item.code) ||
            pickedCodes.includes(rawCur.code),
          disabled:
            (pickedCodes.includes(item.code) ||
              handleCodesCompare(item.code, pickedCodes)) && // 只有省code在新增时使下级市历史数据置灰
            !(
              editAddressCodes.includes(item.code) ||
              handleCodesCompare(item.code, editAddressCodes)
            ), // 有一个市code在编辑时防止其他同级市被置灰
          active: false,
          count: 0,
          children: children2,
        }
      })
      // 省数据
      arr.push({
        label: rawCur.name,
        code: rawCur.code,
        indeterminate:
          children1.length > 0 &&
          children1.some(item => item.checked) &&
          !children1.every(item => item.checked),
        checked:
          pickedCodes.includes(rawCur.code) ||
          (children1.length > 0 && children1.every(item => item.checked)),
        disabled:
          children1.some(item => item.disabled) ||
          (children1.length === 0 &&
            pickedCodes.includes(rawCur.code) &&
            !editAddressCodes.includes(rawCur.code)),
        active: false,
        count: 0,
        children: children1,
      })
      return arr
    }, [])
    // 如果是编辑，需要给checked的code下级加上checked
    if (_.isNumber(editCityIndex)) {
      for (let i = 0; i < citysData.length; i++) {
        if (citysData[i].checked) {
          for (let j = 0; j < citysData[i].children.length; j++) {
            citysData[i].children[j].checked = true
          }
        }
      }
    }
    const initialRegionData = region.map(({ name, value }) => {
      const tempCitys = citysData.filter(citysDataItem =>
        value.includes(citysDataItem.code),
      )
      // 加上大区
      return {
        label: name,
        indeterminate:
          tempCitys.some(item => item.checked || item.indeterminate) &&
          !tempCitys.every(item => item.checked),
        checked: tempCitys.every(item => item.checked),
        disabled: tempCitys.some(item => item.disabled),
        active: false,
        count: 0,
        children: tempCitys,
      }
    })
    // 如果其中有一个被选中，那么就展开
    const regionActiveIndex = initialRegionData.findIndex(item =>
      item.children.some(item => item.checked || item.indeterminate),
    )
    if (regionActiveIndex !== -1) {
      initialRegionData[regionActiveIndex].active = true
      const provinceActiveIndex = initialRegionData[
        regionActiveIndex
      ].children.findIndex(item => item.indeterminate || item.checked)
      initialRegionData[regionActiveIndex].children[
        provinceActiveIndex
      ].active = true
      return setData([
        initialRegionData,
        initialRegionData[regionActiveIndex].children,
        initialRegionData[regionActiveIndex].children[provinceActiveIndex]
          .children,
      ])
    }
    const initialData = [initialRegionData, [], []]
    setData(initialData)
  }, [visible])
  const handleClickRegin = region => {
    // 切换地区，改变省市的显示
    const province: any[] =
      regions.find(v => v.label === region.label)?.children ?? []
    const activeRegions = regions.map(v => ({
      ...v,
      active: v.label === region.label,
    }))
    const activeProvince = province.map((v, i) => ({ ...v, active: i === 0 }))
    formatOutputData([
      activeRegions,
      activeProvince,
      activeProvince[0]?.children ?? [],
    ])
  }

  const handleClickProvince = province => {
    // 切换省，改变市的显示
    const city: any[] =
      provinces.find(v => v.label === province.label)?.children ?? []
    const newProvinces = provinces.map(v => ({
      ...v,
      active: v.label === province.label,
    }))
    formatOutputData([regions, newProvinces, city])
  }

  const handleChangeRegion = (region, checked) => {
    // 在地区点击勾选
    const newRegions = formatChangeRegions(regions, region, checked)
    const newProvinces =
      newRegions.find(v => v.label === region.label)?.children ?? []
    formatOutputData([
      newRegions,
      newProvinces,
      newProvinces[0]?.children ?? [],
    ])
  }

  const handleCheckedAllProvince = checked => {
    // 全选省
    if (!provinces.length) {
      message.warn('请先选择一个地区')
      return
    }
    const region: any = regions.find(v => v.active)
    const province: any = provinces.find(v => v.active) ?? provinces[0]
    const newRegions = regions.map(v => ({
      ...v,
      checked: v === region ? checked : v.checked,
      indeterminate: v === region ? false : v.indeterminate,
      children: v.children.map(p => ({
        ...p,
        active: p.label === province.label,
        indeterminate: v === region ? false : p.indeterminate,
        checked: v === region ? checked : p.checked,
        children: p.children.map(c => ({
          ...c,
          checked: v === region ? checked : c.checked,
        })),
      })),
    }))
    const newProvinces: any = newRegions.find(v => v.active)?.children ?? []
    const activeProvinces = newProvinces.find(v => v.active)
    formatOutputData([
      newRegions,
      newProvinces,
      activeProvinces?.children ?? [],
    ])
  }

  const handleCheckedAllCities = checked => {
    // 全选市
    if (!cities.length) {
      message.warn('请先选择一个地区')
      return
    }
    const region: any = regions.find(v => v.active)
    const province: any = provinces.find(v => v.active)
    const newRegions = regions.map(v => ({
      ...v,
      checked:
        v === region
          ? getRegionIndeterminate(v, province, checked)?.isAllChecked
          : v.checked,
      indeterminate:
        v === region
          ? getRegionIndeterminate(v, province, checked)?.isIndeterminate
          : v.indeterminate,
      children: v.children.map(p => ({
        ...p,
        active: p.label === province.label,
        checked: p.label === province.label ? checked : p.checked,
        indeterminate: p.label === province.label ? false : p.indeterminate,
        children: p.children.map(c => ({
          ...c,
          checked: p.label === province.label ? checked : c.checked,
        })),
      })),
    }))
    const newProvinces: any = newRegions.find(v => v.active)?.children ?? []
    const activeProvinces = newProvinces.find(v => v.active)?.children ?? []
    formatOutputData([newRegions, newProvinces, activeProvinces])
  }
  const handleChangeProvince = (province, checked) => {
    // 在省点击勾选
    const region: any = regions.find(v => v.active)
    const newRegions = regions.map(v => ({
      ...v,
      checked:
        v === region
          ? getRegionIndeterminate(v, province, checked)?.isAllChecked
          : v.checked,
      indeterminate:
        v === region
          ? getRegionIndeterminate(v, province, checked)?.isIndeterminate
          : v.indeterminate,
      children: v.children.map(p => ({
        ...p,
        active: p.label === province.label,
        checked: p.label === province.label ? checked : p.checked,
        indeterminate: p.label === province.label ? false : p.indeterminate,
        children: p.children.map(c => ({
          ...c,
          checked: p.label === province.label ? checked : c.checked,
        })),
      })),
    }))
    const newProvinces: any = newRegions.find(v => v.active)?.children ?? []
    const activeProvinces = newProvinces.find(v => v.active)
    formatOutputData([
      newRegions,
      newProvinces,
      activeProvinces?.children ?? [],
    ])
  }
  const handleChangeCities = (city, checked) => {
    // 在市点击勾选
    const region: any = regions.find(v => v.active)
    const province: any = provinces.find(v => v.active)
    const getRegionIndeterminate = v => {
      const checkedProvince = v.children.map(p => ({
        ...p,
        checked:
          p.label === province.label
            ? getProvinceIndeterminate(p)?.isAllChecked
            : p.checked,
        indeterminate:
          p.label === province.label
            ? getProvinceIndeterminate(p)?.isIndeterminate
            : p.indeterminate,
      }))
      const isAllChecked =
        checkedProvince.length && checkedProvince.every(v => v.checked)
      return {
        isAllChecked,
        // 在点选某个城市的情况下也会反应到地区一栏checkbox的中间态
        // 所以还要判断省份一栏是否有中间态的
        isIndeterminate:
          !isAllChecked &&
          (checkedProvince.some(v => v.checked) ||
            checkedProvince.some(v => v.indeterminate)),
      }
    }
    // 计算省份一栏checkbox的中间态
    const getProvinceIndeterminate = p => {
      const checkedCities = p.children.map(c => ({
        ...c,
        checked: c.label === city.label ? checked : c.checked,
      }))
      const isAllChecked =
        checkedCities.length && checkedCities.every(v => v.checked)
      return {
        isAllChecked,
        isIndeterminate: !isAllChecked && checkedCities.some(v => v.checked),
      }
    }
    const newRegions = regions.map(v => ({
      ...v,
      checked:
        v === region ? getRegionIndeterminate(v)?.isAllChecked : v.checked,
      indeterminate:
        v === region
          ? getRegionIndeterminate(v)?.isIndeterminate
          : v.indeterminate,
      children: v.children.map(p => ({
        ...p,
        active: p.label === province.label,
        checked:
          p.label === province.label
            ? getProvinceIndeterminate(p)?.isAllChecked
            : p.checked,
        indeterminate:
          p.label === province.label
            ? getProvinceIndeterminate(p)?.isIndeterminate
            : p.indeterminate,
        children: p.children.map(c => ({
          ...c,
          checked: c.label === city.label ? checked : c.checked,
        })),
      })),
    }))
    const newProvinces: any = newRegions.find(v => v.active)?.children ?? []
    const activeProvinces = newProvinces.find(v => v.active)
    formatOutputData([
      newRegions,
      newProvinces,
      activeProvinces?.children ?? [],
    ])
  }
  const formatOutputData = payload => {
    // 需要得到一份选中表，编辑的话就是一直都有
    setData(payload)
    const provinceCode = payload[1]
      .filter(item => item.checked && !item.disabled)
      .map(item => item.code) // 拿到选中的省的code
    const provinceName = payload[1]
      .filter(item => item.checked && !item.disabled)
      .map(item => item.label) // 拿到选中的省的name
    const notChooseProvinceCode = payload[1]
      .filter(item => !item.checked)
      .map(item => item.code) // 拿到当前页未选中的省的code
    const notChooseProvinceName = payload[1]
      .filter(item => !item.checked)
      .map(item => item.label) // 拿到当前页未选中的省的name
    const notChooseCityCode =
      payload.length === 3
        ? payload[2].filter(item => !item.checked).map(item => item.code)
        : [] // 拿到当前页未选中的市区的code
    const notChooseCityName =
      payload.length === 3
        ? payload[2].filter(item => !item.checked).map(item => item.label)
        : [] // 拿到当前页未选中的市区的name
    let citys = payload[2]
      .filter(item => item.checked && !item.disabled)
      .map(item => {
        return {
          code: item.code,
          name: item.label,
        }
      }) // 拿到选中的市的code
    // 去掉省市重合部分
    citys = citys.filter(
      city =>
        !provinceCode.some(
          pCode => pCode.substring(0, 2) === city.code.substring(0, 2),
        ),
    )
    const cityCode = citys.map(item => item.code)
    const cityName = citys.map(item => item.name)
    // 已经选中的code和name
    const pickedCodes = _.flatten(pickedData.map(item => item.value))
    const pickedNames = _.flatten(
      pickedData.map(item => {
        if (item.names.includes('全国')) {
          return allProvinceName
        }
        return item.names.split(',')
      }),
    )
    const deleteCodes = [
      ...pickedCodes.filter(
        item =>
          notChooseProvinceCode.includes(item) ||
          notChooseCityCode.includes(item),
      ),
      ...outPutCodes.filter(
        item =>
          notChooseProvinceCode.includes(item) ||
          notChooseCityCode.includes(item),
      ),
    ]
    const deleteNames = [
      ...pickedNames.filter(
        item =>
          notChooseProvinceName.includes(item) ||
          notChooseCityName.includes(item),
      ),
      ...outPutNames.filter(
        item =>
          notChooseProvinceName.includes(item) ||
          notChooseCityName.includes(item),
      ),
    ]
    const rewriteCodes = [
      ...outPutCodes.filter(item => !deleteCodes.includes(item)),
    ]
    const rewriteNames = [
      ...outPutNames.filter(item => !deleteNames.includes(item)),
    ]
    let formatFinalCodes = formatFinalRes([
      ...rewriteCodes,
      ...provinceCode,
      ...cityCode,
    ])
    let formatFinalNames = formatFinalRes([
      ...rewriteNames,
      ...provinceName,
      ...cityName,
    ])
    const deleteIndex = []
    // 最后再筛选一遍是否有重复的市,code为6位纯数字,省的格式为“2位省code + 0000”,省一下的城市后四位不为0
    formatFinalCodes = formatFinalCodes.filter((item: string, index) => {
      if (item.slice(2) !== '0000') {
        const tempPCode = item.slice(0, 2)
        if (
          formatFinalCodes.some(
            (code: string) =>
              code.slice(2) === '0000' && code.includes(tempPCode),
          )
        ) {
          deleteIndex.push(index)
          return false
        }
      }
      return true
    })
    formatFinalNames = formatFinalNames.filter((_, index) => {
      if (deleteIndex.includes(index)) {
        return false
      }
      return true
    })
    setOutPutCodes(formatFinalCodes)
    setOutPutNames(formatFinalNames)
  }
  const formatFinalRes = data => {
    return [...new Set(data)].filter(item => !!item)
  }
  const handleCodesCompare = (code, codeArr) => {
    return codeArr
      .map(item => {
        if (item.slice(2) === '0000') {
          return item.slice(0, 2)
        }
      })
      .some(item => code && item && code.startsWith(item))
  }
  return (
    <Modal
      className='choose-city-modal'
      visible={visible}
      closable
      onCancel={onCancel}
      onOk={() => onOk(outPutCodes, outPutNames, editCityIndex)}
      width={580}
      destroyOnClose
      title={
        <span>
          选择配送城市&nbsp;
          <span className='tip'>未选择的城市将默认为不可配送地区</span>
        </span>
      }
    >
      <Row className='column-row'>
        <Col span={8} className='area'>
          地区
        </Col>
        <Col span={8}>
          <PlaceCell
            place='省'
            checked={provinceChecked}
            disabled={provinceDisabled}
            indeterminate={provinceIndeterminate}
            onChange={e => handleCheckedAllProvince(e.target.checked)}
          />
        </Col>
        <Col span={8}>
          <PlaceCell
            place='市/区'
            checked={citiesChecked}
            disabled={citiesDisabled}
            indeterminate={citiesIndeterminate}
            onChange={e => handleCheckedAllCities(e.target.checked)}
          />
        </Col>
      </Row>
      <Row className='column-data'>
        <Col span={8}>
          {regions.map(v => (
            <PlaceCell
              key={v.label}
              place={v.label}
              indeterminate={v.indeterminate}
              checked={v.checked}
              disabled={v.disabled}
              active={v.active}
              onClick={() => handleClickRegin(v)}
              onChange={e => handleChangeRegion(v, e.target.checked)}
            />
          ))}
        </Col>
        <Col span={8}>
          {provinces.map(v => (
            <PlaceCell
              key={v.label}
              place={v.label}
              indeterminate={v.indeterminate}
              checked={v.checked}
              disabled={v.disabled}
              count={v.children?.filter(v => v.checked)?.length}
              active={v.active}
              onClick={() => handleClickProvince(v)}
              onChange={e => handleChangeProvince(v, e.target.checked)}
            />
          ))}
        </Col>
        <Col span={8} style={{ height: '364px', overflowY: 'auto' }}>
          {cities.map(v => (
            <PlaceCell
              key={v.label}
              place={v.label}
              checked={v.checked}
              disabled={v.disabled}
              onChange={e => handleChangeCities(v, e.target.checked)}
            />
          ))}
        </Col>
      </Row>
    </Modal>
  )
}

export default ChooseCityModal
