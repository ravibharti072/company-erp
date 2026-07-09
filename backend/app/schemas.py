from app.schemas_modules.auth import (
    LoginRequest,
    TokenResponse,
    ChangePasswordRequest,
)

from app.schemas_modules.companies import (
    CompanyCreate,
    CompanyResponse,
)

from app.schemas_modules.users import (
    UserCreate,
    UserUpdate,
    UserResponse,
)

from app.schemas_modules.attendance import (
    AttendanceCheckIn,
    AttendanceResponse,
)

from app.schemas_modules.tasks import (
    TaskCreate,
    TaskUpdate,
    TaskResponse,
)

from app.schemas_modules.sales import (
    SalesLeadCreate,
    SalesLeadUpdate,
    SalesLeadResponse,
    SalesLeadStatusUpdate,
    LeadConvertRequest,
    LeadConvertResponse,
    LeadDeliverRequest,
    LeadCompleteRequest,
    SalesCommissionUpdate,
    SalesCommissionResponse,
    ReceivedPaymentCreate,
    ReceivedPaymentUpdate,
    ReceivedPaymentResponse,
    ReceivedPaymentSummaryResponse,
    LeadPaymentSummaryResponse,
    CRMProjectCreate,
    CRMProjectUpdate,
    CRMProjectResponse,
    CRMProjectStatusUpdate,
    CRMSummaryResponse,
    SoftwareProductCreate,
    SoftwareProductUpdate,
    SoftwareProductResponse,
    ProjectToSoftwareProductRequest,
)

from app.schemas_modules.commissions import (
    CommissionPercentageUpdate,
    CommissionPaymentCreate,
    CommissionPaymentResponse,
    CommissionResponse,
    CommissionSummaryResponse,
)

from app.schemas_modules.freelancers import (
    FreelancerProjectCreate,
    FreelancerProjectUpdate,
    FreelancerProjectResponse,
    FreelancerPaymentCreate,
    FreelancerPaymentUpdate,
    FreelancerPaymentResponse,
    FreelancerPaymentGenerateResponse,
)