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

class Modal extends Component {
	render(){
		return h('div',{class:'modal',id:this.props.id || 'modal'},
			h('a',{href:'#close',class:'modal-overlay'}),
			h('div',{class:'modal-container'},
				h('div',{class:'modal-header'},
					h('a',{href:'#close',class:'btn btn-clear float-right'}),
					h('div',{class:'modal-title h4'},this.props.title || 'Title')
				),
				h('div',{class:'modal-body'},
					this.body && this.body()
				),
				h('div',{class:'modal-footer'},
					this.footer && this.footer()
				)
			)
		)
	}
}

class NewProfessionModal extends Modal {
	createProfession(e){
		this.props.createProfession(this.state.profession)
	}
	body(){
		return h('div',undefined,
			h('div',{class:'form-group'},
				h('select',{class:'form-select',value:this.state.profession,onInput:e => this.setState({profession:e.target.value})},
					this.props.professions.map(p => h('option',{value:p},p))
				),
				h('a',{class:'btn mt-1',href:'#close',disabled:!this.state.profession,onClick:e => this.createProfession(e)},'Create Profession')
			)
		)
	}
}

class ProfessionForm extends Component {
	constructor(props){
		super(props)
		this.setState({profession:this.props.profession})
	}
	updateValue(o,k,v){
		o[k] = v
		this.props.refresh()
	}
	addCertification(){
		this.state.profession.certifications.unshift({})
		this.setState(this.state)
	}
	removeCertification(){
		this.state.profession.certifications.shift()
		this.props.refresh()
	}
	async save(){
		if(confirm('Really Save?')){
			this.state.profession.token = window.localStorage.getItem('token')
			this.setState({loading:true})
			const r = await lambda.invoke({
				FunctionName:'fitu_save_professional',
				Payload:JSON.stringify(this.state.profession)
			}).promise()
			if(r.FunctionError){
				alert(JSON.parse(r.Payload).errorMessage)
			}else{
				alert('Your application was submitted for review.  You will get an email shortly')
			}
			this.setState({loading:false})
		}
	}
	render(){
		return h('div',undefined,
			h('div',{class:'form-group'},
				h('label',{class:'form-label'},'First Name'),
				h('input',{
					required:true,
					class:'form-input',
					value:this.state.profession.name.first,
					onInput:e => this.updateValue(this.state.profession.name,'first',e.target.value)
				})
			),
			h('div',{class:'form-group'},
				h('label',{class:'form-label'},'Middle Name'),
				h('input',{
					class:'form-input',
					value:this.state.profession.name.middle,
					onInput:e => this.updateValue(this.state.profession.name,'middle',e.target.value)
				})
			),
			h('div',{class:'form-group'},
				h('label',{class:'form-label'},'Last Name'),
				h('input',{
					class:'form-input',
					value:this.state.profession.name.last,
					onInput:e => this.updateValue(this.state.profession.name,'last',e.target.value)
				})
			),
			h('div',{class:'form-group'},
				h('label',{class:'form-label'},'Gender'),
				h('select',{
					class:'form-select',
					value:this.state.profession.gender,
					onInput:e => this.updateValue(this.state.profession,'gender',e.target.value)
				},
					h('option',{value:'Male'},'Male'),
					h('option',{value:'Female'},'Female')
				)
			),
			h('div',{class:'divider text-center','data-content':'Certifications'}),
			h('div',{class:'container'},
				h('button',{class:'btn',onClick:e => this.addCertification()},'Add'),
				h('button',{class:'btn float-right',onClick:e => this.removeCertification()},'Remove')
			),
			this.state.profession.certifications.map((cert,index) => 
				h('div',{class:'columns'},
					h('div',{class:'column col-12 columns'},
						h('div',{class:'column col-4'},
							h('label',{class:'form-label'},'Certification'),
							h('select',{
								class:'form-select',
								value:cert.name,
								onInput:e => this.updateValue(cert,'name',e.target.value)
							},
							this.props.certifications && Object.keys(this.props.certifications).map(c => 
								h('option',{value:c},c)
							))
						),
						h('div',{class:'column col-4'},
							h('label',{class:'form-label'},'Expires On'),
							h('input',{
								class:'form-input',
								type:'date',
								value:cert.expirationDate,
								min:new Date().toISOString().split('T')[0],
								onInput:e => this.updateValue(cert,'expirationDate',e.target.value)
							})
						),
						h('div',{class:'column col-4'},
							h('label',{class:'form-label'},'Institute'),
							h('select',{
								class:'form-select',
								value:cert.institute,
								onInput:e => this.updateValue(cert,'institute',e.target.value)
							},
							this.props.certifications && this.props.certifications[cert.name] && this.props.certifications[cert.name].map(c => 
								h('option',{value:c.institute},c.institute)
							))
						)
					)
				)
			),
			h('div',{class:'text-center mt-2'},
				h('button',{class:`btn btn-success ${this.state.loading ? 'loading' : ''}`,disabled:!this.state.profession.certifications.length,onClick:e => this.save()},'Save')
			)
		)
	}
}

class Professions extends Component {
	constructor(props){
		super(props)
		this.state.newProfessionModalId = 'npModal'
		this.state.professions = []
		this.state.reference = {}
		this.getProfessions()
		this.getReferenceData()
	}
	async getProfessions(key){
		const r = await dynamodb.query({
			TableName:'fitu_professionals',
			ExclusiveStartKey:key,
			KeyConditions:{
				'email':{
					ComparisonOperator:'EQ',
					AttributeValueList:[window.localStorage.getItem('email')]
				}
			}
		}).promise()
		this.state.professions = this.state.professions.concat(r.Items)
		if(r.LastEvaluatedKey){
			this.getQueries(r.LastEvaluatedKey)
		}else{
			this.setState(this.state)
		}
	}
	async getReferenceData(){
		const r = await dynamodb.get({
			TableName:'configs',
			Key:{
				partitionKey:'fitu_reference_professions'
			}
		}).promise()
		r.Item.data.forEach(r => {
			this.state.reference[r.profession] = this.state.reference[r.profession] || {}
			const certifications = this.state.reference[r.profession]
			certifications[r.certification] = certifications[r.certification] || []
			certifications[r.certification].push({institute:r.institute,price:r.price})
		})
		this.setState(this.state)
	}
	createProfession(profession){
		if(this.state.professions.find(p => p.profession === profession)){
			return alert('You already have this profession')
		}
		this.state.professions.push({
			profession:profession,
			name:{},
			certifications:[],
			gender:undefined
		})
		this.setState(this.state)
	}
	maxPrice(p){
		if(!this.state.reference[p.profession]){
			return 0
		}
		return p.certifications.reduce((a,c) => {
			const r = this.state.reference[p.profession][c.name].find(r => r.institute === c.institute)
			return Math.max(a,r ? r.price : 0)
		},0)
	}
	render(){
		return h('div',undefined,
			h('div',{class:'text-center mb-1'},
				h('a',{href:`#${this.state.newProfessionModalId}`,class:'btn'},'New Profession'),
				h(NewProfessionModal,{
					title:'Choose a Profession',
					id:this.state.newProfessionModalId,
					createProfession:p => this.createProfession(p),
					professions:Object.keys(this.state.reference)
				})
			),
			h('div',undefined,
				this.state.professions.map(p => 
					h('div',{class:'accordion'},
					  h('input',{type:'checkbox',id:`a-${p.profession}`,hidden:true}),
					  h('label',{class:"accordion-header bg-secondary text-center",for:`a-${p.profession}`},
					    h('i',{class:"icon icon-arrow-right mr-1"}),
					    `${p.profession} - Max Price: $${this.maxPrice(p)}`
					  ),
					  h('div',{class:"accordion-body"},
					  	h(ProfessionForm,{
					  		profession:p,
					  		certifications:this.state.reference[p.profession],
					  		refresh:state => this.setState(state || this.state)
					  	})
					  )
					)
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

class Container extends Component {
	constructor(props){
		super(props)
	}
	hasAuth(){
		return window.localStorage.getItem('email') && window.localStorage.getItem('token')
	}
	content(){
		return h('div',{class:'container'},
			h(Professions,{})
		)
	}
	render(){
		return this.hasAuth() ? this.content() : h(Auth)
	}
}

document.addEventListener('DOMContentLoaded', () => render(h(Container), document.body))