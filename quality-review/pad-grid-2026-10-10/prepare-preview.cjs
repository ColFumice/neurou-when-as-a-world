// Prepare this request's evidence harness without modifying archived A/B evidence.
const fs = require('fs');
const path = require('path');
let source = fs.readFileSync(path.resolve(__dirname, '../guidance-b/creator-preview.cjs'), 'utf8');
source = source.replace('No source edits and no artificial score/node state.', 'Fullscreen 47-slot and adjacent-key real Creator evidence. No source edits or artificial score/node state.');
source = source.replace("if (!input) throw new Error('InputCollector not found in live scene');", "if (!input) throw new Error('InputCollector not found in live scene');\n  cc.profiler.hideStats(); // After scene ready, hide debug-only overlay so all 47 labels can be inspected.");
source = source.replace('Only DirectorSession.endpointSettled=true to bypass the already-tested T6 entrance.', 'Only DirectorSession.endpointSettled=true to bypass the already-tested T6 entrance; cc.profiler.hideStats hides the debug overlay for unobstructed visual inspection.');
source = source.replace("{name:'GuidanceLineRuntime.ts',source:'src/chart/GuidanceLineRuntime.ts',markers:['holdRemainingPoints','holdInterrupted = true',\"(a.kind === 'Tail' ? 0 : 1) - (b.kind === 'Tail' ? 0 : 1)\"]},", "{name:'GuidanceLineRuntime.ts',source:'src/chart/GuidanceLineRuntime.ts',markers:['hasHeldGridKey','isMatchingGridKey']},");
source = source.replace("{name:'GuidanceChart.ts',source:'src/chart/GuidanceChart.ts',markers:['slicePathByDistance']},", "{name:'GuidanceChart.ts',source:'src/chart/GuidanceChart.ts',markers:['slicePathByDistance']},\n  {name:'KeyboardPadLayout.ts',source:'src/chart/KeyboardPadLayout.ts',markers:['pad-layout-2','isMatchingGridKey']},\n  {name:'ChartPadView.ts',source:'src/presentation/ChartPadView.ts',markers:['rebuildSlotLabels','resolveContentRect(width, height)']},");
source = source.replace('inputEvents: [], sync: []', 'inputEvents: [], neighborInputs: [], sync: []');
source = source.replace('score:p.getTotalScore(),result:p.getResult(),line,', `score:p.getTotalScore(),result:p.getResult(),line,
      layout:{version:builder.chartPadView.layout.layoutVersion,slots:builder.chartPadView.layout.slots,
        logicMatchesView:JSON.stringify(builder.keyboardLayout.slots)===JSON.stringify(builder.chartPadView.layout.slots),
        labelNames:builder.chartPadView.slotLabelNodes.map(node=>node.name),labels:builder.chartPadView.slotLabels.map(label=>label.string),
        container:[builder.chartPadView.node.getComponent(cc.UITransform).width,builder.chartPadView.node.getComponent(cc.UITransform).height],
        labelPositions:builder.chartPadView.slotLabelNodes.map(node=>({name:node.name,x:node.position.x,y:node.position.y}))},`);
source = source.replace('runtime.targetTime=node=>', `runtime.neighborFor=(keyId,kind)=>{
    const target=builder.keyboardLayout.slots.find(slot=>slot.keyId===keyId);
    if(!target)throw new Error('No target slot '+keyId);
    const epsilon=1e-9;
    const neighbors=builder.keyboardLayout.slots.filter(slot=>slot.keyId!==keyId&&slot.keyId!=='Space'&&(kind!=='Tap'||!runtime.heldKeys.has(slot.keyId))).map(slot=>{
      const overlapX=Math.min(target.u+target.width,slot.u+slot.width)-Math.max(target.u,slot.u);
      const overlapY=Math.min(target.v+target.height,slot.v+slot.height)-Math.max(target.v,slot.v);
      return {slot,overlapX,overlapY,relation:Math.abs(overlapX)<=epsilon&&Math.abs(overlapY)<=epsilon?'corner':slot.v===target.v?'horizontal':'vertical'};
    }).filter(item=>item.overlapX>=-epsilon&&item.overlapY>=-epsilon);
    const preferred=kind==='Tap'?'corner':kind==='Hold'?'vertical':'horizontal';
    const candidate=neighbors.find(item=>item.relation===preferred)||neighbors[0];
    if(!candidate)throw new Error('No touching neighbor for '+keyId);
    if(!layoutModule.isMatchingGridKey(builder.keyboardLayout,keyId,candidate.slot.keyId))throw new Error('Independent touching neighbor rejected');
    return {keyId:candidate.slot.keyId,relation:candidate.relation};
  };
  runtime.targetTime=node=>`);
source = source.replace('runtime.nodeInputs.add(node.id);runtime.press(key);', `const neighbor=runtime.neighborFor(key,'Tap');
        runtime.neighborInputs.push({nodeId:node.id,kind:node.kind,targetKeyId:key,inputKeyId:neighbor.keyId,relation:neighbor.relation,timeMs:now});
        runtime.nodeInputs.add(node.id);runtime.press(neighbor.keyId);`);
source = source.replace("if(!runtime.nodeInputs.has(node.id)&&now>=target-100){runtime.nodeInputs.add(node.id);runtime.heldKeys.add(node.keyId);runtime.edge(node.keyId,true);}", `const neighbor=runtime.neighborFor(node.keyId,node.kind);
        if(!runtime.nodeInputs.has(node.id)&&now>=target-100){
          runtime.neighborInputs.push({nodeId:node.id,kind:node.kind,targetKeyId:node.keyId,inputKeyId:neighbor.keyId,relation:neighbor.relation,timeMs:now});
          runtime.nodeInputs.add(node.id);runtime.heldKeys.add(neighbor.keyId);runtime.edge(neighbor.keyId,true);
        }`);
source = source.replace('if(runtime.heldKeys.has(node.keyId)&&now>=releaseAt){runtime.heldKeys.delete(node.keyId);runtime.edge(node.keyId,false);}', 'if(runtime.heldKeys.has(neighbor.keyId)&&now>=releaseAt){runtime.heldKeys.delete(neighbor.keyId);runtime.edge(neighbor.keyId,false);}');
source = source.replace("console.log('B HARNESS '+report.resolution);", "console.log('PAD GRID HARNESS '+report.resolution);");
source = source.replace('r.autoHead=true;r.autoNodes=true;r.input.requestEnterChart();', 'r.autoHead=true;r.autoNodes=false;r.input.requestEnterChart();');
source = source.replace("report.nodesBefore=await screenshot('tap-drag-hold-before',report);", `report.nodesBefore=await screenshot('fullscreen-grid',report);
  const layout=report.nodesBefore.layout;
  assert.equal(layout.version,'pad-layout-2');assert.equal(layout.slots.length,47);assert.equal(layout.logicMatchesView,true);
  assert.equal(layout.slots.some(slot=>slot.keyId==='Space'),false);assert.equal(layout.labelNames.length,47);
  assert.equal(layout.labelNames.some(name=>name.includes('Space')),false);assert.equal(layout.labels.includes('SPACE'),false);
  const rows=[...new Set(layout.slots.map(slot=>slot.v))].sort((a,b)=>b-a);
  assert.deepEqual(rows,[.75,.5,.25,0]);
  const rowReports=rows.map(v=>{
    const slots=layout.slots.filter(slot=>slot.v===v).sort((a,b)=>a.u-b.u);
    assert.equal(slots[0].u,0);assert.ok(Math.abs(slots.at(-1).u+slots.at(-1).width-1)<1e-9);
    slots.forEach((slot,index)=>{assert.equal(slot.height,.25);assert.ok(Math.abs(slot.width-1/slots.length)<1e-9);if(index)assert.ok(Math.abs(slots[index-1].u+slots[index-1].width-slot.u)<1e-9);});
    return {v,keyCount:slots.length,width:slots[0].width,height:slots[0].height,fullWidth:true};
  });
  assert.deepEqual(rowReports.map(row=>row.keyCount),[13,13,11,10]);
  assert.ok(rowReports[3].width>rowReports[2].width&&rowReports[2].width>rowReports[0].width);
  for(const slot of layout.slots){
    const position=layout.labelPositions.find(item=>item.name==='SlotLabel-'+slot.keyId);
    assert.ok(position);assert.ok(Math.abs(position.x-(slot.u+slot.width/2-.5)*layout.container[0])<1e-3);
    assert.ok(Math.abs(position.y-(slot.v+slot.height/2-.5)*layout.container[1])<1e-3);
  }
  report.grid={rows:rowReports,slotCount:47,labels:layout.labels,logicEqualsView:true,noSpaceLabel:true,allRowsTileFullContainer:true};
  report.checks.push({name:'47 visible non-Space slots form 13/13/11/10 full-width rows, 25% height; shorter rows have wider cells; live logic matches presentation',pass:true});
  await evaluate(()=>{window.__guidancePreview.autoNodes=true;});`);
source = source.replace("report.checks.push({name:'Drag independently bound key held at crossing triggers once',pass:true});", "report.checks.push({name:'Drag touching horizontal neighbor, different from bound target, held at crossing triggers Perfect once',pass:true});");
source = source.replace("report.checks.push({name:'Hold resolves once at complete tail and starts media-time disappearance there',pass:true});", "report.checks.push({name:'Hold touching vertical neighbor held across complete interval resolves Perfect once; disappearance begins at complete tail',pass:true});");
source = source.replace('report.inputEvents=await evaluate(()=>window.__guidancePreview.inputEvents);', `report.inputEvents=await evaluate(()=>window.__guidancePreview.inputEvents);
  report.neighborInputs=await evaluate(()=>window.__guidancePreview.neighborInputs);
  assert.equal(report.neighborInputs.length,8);assert.ok(report.neighborInputs.every(event=>event.inputKeyId!==event.targetKeyId&&event.inputKeyId!=='Space'));
  assert.ok(report.neighborInputs.some(event=>event.kind==='Tap'&&event.relation==='corner'));
  assert.deepEqual(new Set(report.neighborInputs.map(event=>event.kind)),new Set(['Tap','Drag','Hold']));
  report.checks.push({name:'All 8 node inputs over two entries intentionally use a different touching neighbor; Tap uses true diagonal/corner contacts; P4/G0/M0',pass:true});`);
fs.writeFileSync(path.join(__dirname,'creator-preview.cjs'),source);
console.log('Prepared fullscreen grid + neighboring-key Creator evidence harness.');
