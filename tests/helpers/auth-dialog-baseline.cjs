const assert=require('node:assert/strict'),{createHash}=require('node:crypto');
const digest=s=>createHash('sha256').update(s).digest('hex');
const edits=[
  [
    "        );\n\n      if (existing) {\n        existing.close();\n        existing.remove();\n      }\n\n      const authModal =\n        document.createElement(\n          'dialog'\n        );\n\n      authModal.id =\n        'austa-v39-auth-modal';\n\n      authModal.setAttribute('aria-label','A-USTA hesabına giriş');\n      authModal.setAttribute('aria-modal','true');\n\n      authModal.style.cssText = `\n        position:fixed;\n        inset:0;\n        margin:0;\n        width:100%;\n        height:100%;\n        max-width:none;\n        max-height:none;\n        border:0;\n        box-sizing:border-box;\n        display:flex;\n        align-items:center;\n        justify-content:center;\n",
    "        );\n\n      if (existing) {\n        existing.remove();\n      }\n\n      const authModal =\n        document.createElement(\n          'div'\n        );\n\n      authModal.id =\n        'austa-v39-auth-modal';\n\n      authModal.style.cssText = `\n        position:fixed;\n        inset:0;\n        z-index:999999;\n        display:flex;\n        align-items:center;\n        justify-content:center;\n"
  ],
  [
    "          'new-password';\n      };\n\n      // Native top layer makes the Account and page inert without z-index races.\n      function closeAuth(){\n        if(!authModal.isConnected)return;\n        authModal.close();\n        authModal.remove();\n        const target=button.isConnected&&button.getClientRects().length?button:$('.austa-v39-close',modal);\n        target?.focus({preventScroll:true});\n      }\n      authModal.addEventListener('cancel',event=>{event.preventDefault();closeAuth();});\n      authModal.addEventListener('keydown',event=>{\n        if(event.key!=='Tab')return;\n        const controls=[...authModal.querySelectorAll('button:not(:disabled),a[href],input:not(:disabled),select:not(:disabled),textarea:not(:disabled)')].filter(el=>el.getClientRects().length);\n        const first=controls[0],last=controls.at(-1);\n        if(event.shiftKey&&document.activeElement===first){event.preventDefault();last?.focus();}\n        else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first?.focus();}\n      });\n      closeButton.onclick = closeAuth;\n\n      authModal.onclick = (event) => {\n        if (\n          event.target ===\n          authModal\n        ) {\n          closeAuth();\n        }\n      };\n\n",
    "          'new-password';\n      };\n\n      closeButton.onclick = () => {\n        authModal.remove();\n      };\n\n      authModal.onclick = (event) => {\n        if (\n          event.target ===\n          authModal\n        ) {\n          authModal.remove();\n        }\n      };\n\n"
  ],
  [
    "            );\n\n            setTimeout(() => {\n              if(!authModal.isConnected)return;\n              showRole(\n                savedRole\n              );\n              closeAuth();\n            }, 700);\n\n            return;\n",
    "            );\n\n            setTimeout(() => {\n              authModal.remove();\n\n              showRole(\n                savedRole\n              );\n            }, 700);\n\n            return;\n"
  ],
  [
    "          }\n\n          setTimeout(() => {\n            if(!authModal.isConnected)return;\n            showRole(\n              selectedRole\n            );\n            closeAuth();\n          }, 1000);\n        } catch (error) {\n          console.error(\n",
    "          }\n\n          setTimeout(() => {\n            authModal.remove();\n\n            showRole(\n              selectedRole\n            );\n          }, 1000);\n        } catch (error) {\n          console.error(\n"
  ],
  [
    "\n      setMode('login');\n\n      authModal.showModal();\n      emailInput.focus();\n    };\n  });\n",
    "\n      setMode('login');\n\n      emailInput.focus();\n    };\n  });\n"
  ]
];
exports.normalize=html=>{
 if(!html.includes("authModal.showModal();"))return html;
 const tag='<script id="austa-v39-account-js">',start=html.indexOf(tag)+tag.length,end=html.indexOf('</script>',start);
 assert.equal(digest(html.slice(start,end)),'862e2cff9663dba4b0e5e095c571be34fbe5f64f41463fd85817666cff0c90e8','exact V33D2 G01 Account controller');
 for(const [from,to] of edits){assert.equal(html.split(from).length,2,'unique G01 literal hunk');html=html.replace(from,()=>to);}
 assert.equal(digest(html.slice(start,html.indexOf('</script>',start))),'f47aec624d759c8d10edfe7e5645b882265f19bec55d88b9722cf92fe73e1733','reviewed pre-G01 controller restored for historical compatibility');
 return html;
};
