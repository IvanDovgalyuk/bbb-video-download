const { renderSlides } = require("./slides")
const { parseDeskshares } = require("./deskshare")
const childProcess = require('child_process')
const fs = require("fs")
const util = require('util')
const { getVideoInfo } = require('./util')

module.exports.createPresentationVideo = async (config, metadata) => {

    const slides = await renderSlides(config, metadata)
    const deskshares = await parseDeskshares(config)

    if (!slides && !deskshares)
        return null

    if (slides && !deskshares)
        return await onlySlides(slides)

    if (!slides && deskshares)
        return await onlyDeskshares(deskshares)

    return await combinedSlidesAndDeskshares(slides, deskshares, config)

}
const onlySlides = async (slides) => {
    return await getVideoInfo(slides.video)
}

const onlyDeskshares = async (deskshares) => {
    return await getVideoInfo(deskshares.video)
}

const combinedSlidesAndDeskshares = async (slides, deskshares, config) => {
    const filtersScriptFile = config.workdir + '/filters.txt'
    const tmpFile = config.workdir + '/presentation.tmp.mp4'
    const outFile = config.workdir + '/presentation.mp4'

    // let dparts = ''
    // deskshares.parts.forEach((part,index) => {dparts += '[d' + index + ']'});

    // const filters = [`[1][0]scale2ref=ow*mdar:ih[d][v1];[d]split${dparts}`]
    // deskshares.parts.forEach((part,index) => {
    //     filters.push(`[v${filters.length}][d${index}]overlay=enable='between(t,${part.start},${part.end})'[v${filters.length+1}]`)
    // })
    const filters = []
    deskshares.parts.forEach((part,index) => {
        const inStream = (index == 0) ? '[0]' : '[v' + filters.length + ']'
        filters.push(`[1]trim=${part.start}:${part.end}[d${index}];[d${index}]${inStream}scale2ref=oh*mdar:ih[do${index}][s${index}];[s${index}][do${index}]overlay=enable='between(t,${part.start},${part.end})'[v${filters.length+1}]`)
    })

    fs.writeFileSync(filtersScriptFile, filters.join(";\n"))

    const cmd = `ffmpeg -hide_banner -loglevel error -i ${slides.video} -i ${deskshares.video} -filter_complex_script ${filtersScriptFile} -map '[v${filters.length}]' -threads 1 -strict -2 ${tmpFile}`
    childProcess.execSync(cmd)
    if (fs.existsSync(outFile))
        fs.unlinkSync(outFile)
    fs.renameSync(tmpFile, outFile)

    return await getVideoInfo(outFile)
}