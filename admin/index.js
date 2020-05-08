const params = new URLSearchParams(window.location.search)
if(params.get('token') && params.get('email')){
	window.localStorage.setItem('token', params.get('token'))
	window.localStorage.setItem('email', params.get('email'))
	history.pushState({},undefined,window.location.href.replace(window.location.search,''))
}

const IdentityPoolId = 'us-east-1:4bc785c7-871b-4ebe-bd34-22e168724794'
AWS.config.region = 'us-east-1'
AWS.config.credentials = new AWS.CognitoIdentityCredentials({IdentityPoolId})

const {h,render,Component} = window.preact

const dynamodb = new AWS.DynamoDB.DocumentClient({convertEmptyValues:true})
const lambda = new AWS.Lambda()

/**********************************************/

class Loading extends Component {
	render(){
		return h('div',undefined,
			h('div',{class:'h4 loading'})
		)
	}
}

class Menu extends Component {
	render(){
		return h('div',undefined,
			h('div',{class:'text-center'},
				h('a',{class:'off-canvas-toggle btn', href:'#sidebar'},'Menu')
			),
			h('div',{class:'off-canvas'},	
				h('div',{class:'off-canvas-sidebar',id:'sidebar'},
					h('div',{class:'container'},
						h('ul',{class:'menu'},
							this.props.screens.map(s => h('li',{class:'menu-item'},
								h('a',{href:'#close',onClick:e => this.changeMenu(e,s)},
									h('i',{class:'icon mr-2 '+s.icon}),
									h('label',{class:'form-label d-inline-flex'},s.name)
								)
							))
						)
					)
				),
				h('a',{href:'#close',class:'off-canvas-overlay'})
			)
		)
	}
}

class Modal extends Component {
	render(){
		return h('div',{class:'modal',id:this.props.id},
			h('a',{href:'#close',class:'modal-overlay'}),
			h('div',{class:'modal-container'},
				h('div',{class:'modal-header'},
					h('a',{href:'#close',class:'btn btn-clear float-right'}),
					h('div',{class:'modal-title h4 text-center'},this.props.title)
				),
				h('div',{class:'modal-body'},
					this.props.body && this.props.body
				)
			)
		)
	}
}

class Auth extends Component {
	async auth(e){
		e.preventDefault()
		this.setState({loading:true})
		await lambda.invoke({
			FunctionName:'auth',
			Payload:JSON.stringify({email:this.state.email,url:window.location.href,name:'FitU'})
		}).promise()
		this.setState({loading:false})
		alert('Done!')
	}
	render(){
		return h('div',undefined,
			h('form',{class:'form-group text-center',onSubmit:e => this.auth(e)},
				h('label',{class:'form-label'},'Enter Email'),
				h('input',{class:'form-input text-center',onInput:e => this.setState({email:e.target.value})}),
				h('button',{class:`btn mt-1 ${this.state.loading ? 'loading' : ''}`},'Submit')
			)
		)
	}
}

class Approvals extends Component {
	constructor(props){
		super(props)
		this.state.user = params.get('user')
		this.state.type = params.get('type')
		this.state.changes = []
		this.state.professions = []
		this.state.comments = undefined
		this.refresh()
	}
	async refresh(){
		this.setState({loading:true})
		const professions = new Set()
		const r = await dynamodb.get({
			TableName:'configs',
			Key:{
				partitionKey:'fitu_reference_professions'
			}
		}).promise()
		r.Item.data.forEach(r => professions.add(r.profession))
		this.setState({professions:Array.from(professions), loading:false})
		this.setState({type:this.state.type || this.state.professions[0]})
	}
	async getChange(){
		this.setState({loading:true})
		const r = await lambda.invoke({
			FunctionName:'fitu_get_change',
			Payload:JSON.stringify({
				user:this.state.user,
				type:this.state.type,
				token:window.localStorage.getItem('token')
			})
		}).promise()
		this.setState({loading:false,changes:JSON.parse(r.Payload)})
	}
	async approve(e,c){
		this.setState({loading:true})
		const r = await lambda.invoke({
			FunctionName:'fitu_make_decision',
			Payload:JSON.stringify({
				user:c.email,
				type:c.type,
				data:c.data,
				approved:true,
				token:window.localStorage.getItem('token')
			})
		}).promise()
		this.setState({loading:false})
		await this.getChange()
	}
	async reject(e){
		e && e.preventDefault()
		if(this.state.c){
			this.setState({loading:true})
			const r = await lambda.invoke({
				FunctionName:'fitu_make_decision',
				Payload:JSON.stringify({
					user:this.state.c.email,
					type:this.state.c.type,
					data:this.state.c.data,
					approved:false,
					comments:this.state.comments,
					token:window.localStorage.getItem('token')
				})
			}).promise()
			this.setState({loading:false,c:undefined})
			await this.getChange()
		}
	}
	rejectionModal(){
		return h('form',{onSubmit:e => this.reject(e)},
			h('div',{class:'text-center'},
				h('textarea',{class:'form-input',onInput:e => this.setState({comments:e.target.value}), value:this.state.comments})
			),
			h('div',{class:'text-center mt-2'},
				h('a',{class:'btn',href:'#close',onClick:e => this.reject()},'Reject'),
				h('a',{class:'btn',href:'#close'},'Cancel')
			)
		)
	}
	render(){
		return h('div',undefined,
			h('div',{class:'columns'},
				h('div',{class:'column col-6'},
					h('select',{class:'form-select',value:this.state.type,onInput:e => this.setState({type:e.target.value})},
						this.state.professions.map(p => h('option',{value:p},p))
					)
				),
				h('div',{class:'column col-6'},
					h('input',{class:'form-input',placeholder:'Enter Email',value:this.state.user,onInput:e => this.setState({user:e.target.value})})
				)
			),
			h('div',{class:'text-center'},
				h('button',{class:'btn'+(this.state.loading ? ' loading' : ''),onClick:e => this.getChange()},'Refresh')
			),
			h(Modal,{id:'rejectionModal',title:'Enter Reason for Rejection',body:this.rejectionModal()}),
			h('div',undefined,
				this.state.changes.map((c,i) => 
					h('div',{class:'accordion'},
					  h('input',{type:'checkbox',id:`a-${i}`,hidden:true}),
					  h('label',{class:"accordion-header bg-secondary text-center",for:`a-${i}`},
					    h('i',{class:"icon icon-arrow-right mr-1"}),
					    `${c.email}`
					  ),
					  h('div',{class:"accordion-body"},
					  	h('pre',{style:'height: 15em ; overflow-y: auto'},
					  		JSON.stringify(c.data,null,2)
					  	),
					  	h('div',{class:'btn-group btn-group-block'},
					  		h('button',{class:'btn btn-success',onClick:e => this.approve(e,c)},'Approve'),
					  		h('a',{href:'#rejectionModal',class:'btn',onClick:e => this.setState({c})},'Reject')
					  	)
					  )
					)
				)
			)
		)
	}
}

class ProfilePictures extends Component {
	async submit(e){
		e.preventDefault()
		this.setState({loading:true})
		await lambda.invoke({
			FunctionName:'fitu_profile_picture',
			Payload:JSON.stringify({
				user:this.state.email,
				url:this.state.url,
				token:window.localStorage.getItem('token')
			})
		}).promise()
		this.setState({loading:false})
		alert('Updated profile picture')
	}
	render(){
		return h('form',{class:'container',onSubmit:e => this.submit(e)},
			h('div',{class:'columns'},
				h('div',{class:'column col-6'},
					h('input',{class:'form-input',placeholder:'Enter email',onInput:e => this.setState({email:e.target.value})})
				),
				h('div',{class:'column col-6'},
					h('input',{class:'form-input',placeholder:'Enter photo URL',onInput:e => this.setState({url:e.target.value})})
				)
			),
			h('div',{class:'text-center'},
				h('button',{class:'btn'+(this.state.loading ? ' loading' : ''),disabled:!(this.state.email && this.state.url)},'Submit')
			)
		)
	}
}

class Container extends Component {
	constructor(props){
		super(props)
		this.state.screens = [
			{
				name:'Approvals',
				icon:'icon-check'
			},
			{
				name:'Profile Pictures',
				icon:'icon-photo'
			}
		]
		this.state.screen = this.state.screens[0]
	}
	changeMenu(e,s){
		this.setState({screen:s})
	}
	hasAuth(){
		return window.localStorage.getItem('email') && window.localStorage.getItem('token')
	}
	screen(){
		switch(this.state.screen.name){
			case 'Approvals':
				return h(Approvals)
			case 'Profile Pictures':
				return h(ProfilePictures)
		}
	}
	content(){
		return h('div',{class:'container'},
			h('div',{class:'text-center'},
				h('a',{class:'off-canvas-toggle btn', href:'#sidebar'},'Menu')
			),
			h('div',{class:'off-canvas'},
				h('div',{class:'off-canvas-content',style:'padding: 0px'},
					this.screen()
				),
				h('div',{class:'off-canvas-sidebar',id:'sidebar'},
					h('div',{class:'container'},
						h('ul',{class:'menu'},
							this.state.screens.map(s => h('li',{class:'menu-item'},
								h('a',{href:'#close',onClick:e => this.changeMenu(e,s)},
									h('i',{class:'icon mr-2 '+s.icon}),
									h('label',{class:'form-label d-inline-flex'+(this.state.screen === s ? ' text-bold' : '')},s.name)
								)
							))
						)
					)
				),
				h('a',{href:'#close',class:'off-canvas-overlay'})
			)
		)
	}
	render(){
		return this.hasAuth() ? this.content() : h(Auth)
	}
}

document.addEventListener('DOMContentLoaded', () => render(h(Container), document.body))